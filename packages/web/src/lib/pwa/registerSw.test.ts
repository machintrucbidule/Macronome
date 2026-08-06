import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// B-285: the button used to assert only that updateSW(true) was called — the very call whose
// reload argument the plugin discards, which is why the bug shipped. These tests drive the real
// module against a fake registration instead: the check must hit the network, report a waiting
// worker honestly, and never throw; the activation must skip-waiting and wait to be controlled.
const h = vi.hoisted(() => {
  interface Options {
    onRegisteredSW?: (url: string, r: ServiceWorkerRegistration | undefined) => void;
  }
  const updateSW = vi.fn().mockResolvedValue(undefined);
  const state: { registration: ServiceWorkerRegistration | undefined } = {
    registration: undefined,
  };
  const registerSW = vi.fn((options: Options) => {
    options.onRegisteredSW?.('/sw.js', state.registration);
    return updateSW;
  });
  return { updateSW, registerSW, state };
});
vi.mock('virtual:pwa-register', () => ({ registerSW: h.registerSW }));

/** A worker whose state can be driven, as `settleInstalling` listens for it. */
function fakeWorker(state: string) {
  const listeners = new Set<() => void>();
  return {
    state,
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
    settle(next: string) {
      this.state = next;
      for (const cb of [...listeners]) cb();
    },
  };
}

function fakeRegistration(over: Partial<Record<'installing' | 'waiting', unknown>> = {}) {
  return {
    update: vi.fn().mockResolvedValue(undefined),
    installing: null,
    waiting: null,
    ...over,
  } as unknown as ServiceWorkerRegistration & { update: ReturnType<typeof vi.fn> };
}

/** jsdom has no navigator.serviceWorker; install a container whose events we control. */
function fakeContainer() {
  const listeners = new Set<() => void>();
  const container = {
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
    takeControl: () => {
      for (const cb of [...listeners]) cb();
    },
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
  return container;
}

async function load(registration?: ServiceWorkerRegistration) {
  h.state.registration = registration;
  const mod = await import('./registerSw');
  if (registration) mod.registerServiceWorker();
  return mod;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  h.state.registration = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('registerServiceWorker', () => {
  it('registers the service worker only once', async () => {
    const mod = await load(fakeRegistration());
    mod.registerServiceWorker();
    expect(h.registerSW).toHaveBeenCalledTimes(1);
  });
});

describe('checkForUpdate', () => {
  it('asks the server for a new build and reports one when a worker is waiting', async () => {
    const registration = fakeRegistration({ waiting: fakeWorker('installed') });
    const mod = await load(registration);
    await expect(mod.checkForUpdate()).resolves.toBe('update-ready');
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('reports current when the check finds nothing waiting', async () => {
    const registration = fakeRegistration();
    const mod = await load(registration);
    await expect(mod.checkForUpdate()).resolves.toBe('current');
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('waits for an installing worker to settle before deciding', async () => {
    const installing = fakeWorker('installing');
    const registration = fakeRegistration({ installing });
    const mod = await load(registration);

    let settled = false;
    const pending = mod.checkForUpdate().then((r) => {
      settled = true;
      return r;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    Object.assign(registration, { waiting: installing });
    installing.settle('installed');
    await expect(pending).resolves.toBe('update-ready');
  });

  it('never throws when the update check fails (offline)', async () => {
    const registration = fakeRegistration();
    registration.update.mockRejectedValue(new Error('offline'));
    const mod = await load(registration);
    await expect(mod.checkForUpdate()).resolves.toBe('current');
  });

  it('reports current when no service worker is registered (dev, unsupported)', async () => {
    const mod = await load();
    await expect(mod.checkForUpdate()).resolves.toBe('current');
  });
});

describe('activateUpdate', () => {
  it('skips waiting and resolves once the new worker controls the page', async () => {
    const container = fakeContainer();
    const mod = await load(fakeRegistration({ waiting: fakeWorker('installed') }));

    let done = false;
    const pending = mod.activateUpdate().then(() => (done = true));
    await Promise.resolve();
    expect(h.updateSW).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);

    container.takeControl();
    await pending;
    expect(done).toBe(true);
  });

  it('resolves anyway when the worker never takes control', async () => {
    fakeContainer();
    const mod = await load(fakeRegistration({ waiting: fakeWorker('installed') }));
    vi.useFakeTimers();

    const pending = mod.activateUpdate();
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(pending).resolves.toBeUndefined();
  });

  it('does nothing when no worker is waiting', async () => {
    const mod = await load(fakeRegistration());
    await mod.activateUpdate();
    expect(h.updateSW).not.toHaveBeenCalled();
  });
});
