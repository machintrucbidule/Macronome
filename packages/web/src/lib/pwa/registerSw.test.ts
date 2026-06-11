import { beforeEach, describe, expect, it, vi } from 'vitest';

// PWA-1: registerServiceWorker() registers once; forceUpdate() (the Paramètres button) is the
// only path that activates a waiting SW immediately. The vite-plugin-pwa virtual module is mocked.
const { registerSW, updateSW } = vi.hoisted(() => {
  const updateSW = vi.fn().mockResolvedValue(undefined);
  return { updateSW, registerSW: vi.fn().mockReturnValue(updateSW) };
});
vi.mock('virtual:pwa-register', () => ({ registerSW }));

describe('registerSw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('registers the service worker only once', async () => {
    const mod = await import('./registerSw');
    mod.registerServiceWorker();
    mod.registerServiceWorker();
    expect(registerSW).toHaveBeenCalledTimes(1);
  });

  it('forceUpdate activates a pending update immediately (reload = true)', async () => {
    const mod = await import('./registerSw');
    mod.registerServiceWorker();
    await mod.forceUpdate();
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('forceUpdate is a no-op before registration', async () => {
    const mod = await import('./registerSw');
    await mod.forceUpdate();
    expect(updateSW).not.toHaveBeenCalled();
  });
});
