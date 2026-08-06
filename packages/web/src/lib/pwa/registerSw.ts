import { registerSW } from 'virtual:pwa-register';

// Service-worker registration + the manual "force update" path (PWA-1, ADR-0003).
// registerType is 'prompt' (vite.config.ts): a new build installs in the background and
// activates on the next launch — we deliberately show NO prompt and do NOT auto-reload
// mid-session. A periodic update() keeps long-lived sessions fetching new versions in the
// background. The Paramètres button is the only place that activates now.
//
// B-285: the button used to call updateSW(true) and trust it to reload. It does not — in the
// plugin's build client the reloadPage argument is discarded and the only reload lives in a
// `controlling` listener that exists solely if a `waiting` event fired during this session.
// Nothing asked the server for a new build at click time either, so the common case (deploy,
// then click in an already-open tab) posted a message nobody received and returned silently.
// The two exports below split that into a check and an activation; the caller owns the reload.

// Re-check for a new version this often while the app stays open (background fetch only;
// it still applies on next launch unless the button is used).
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;
// registration.update() can resolve while the new worker is still installing; wait for it to
// settle before deciding, but never hang the button on a slow install.
const INSTALL_TIMEOUT_MS = 10_000;
// A worker that never takes control must not strand the user on the old shell either.
const ACTIVATE_TIMEOUT_MS = 3_000;

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

/** Outcome of asking the server for a new build. */
export type UpdateCheck = 'update-ready' | 'current';

/** Register the service worker once at startup. No-op when SW is unsupported (e.g. dev). */
export function registerServiceWorker(): void {
  if (updateSW) return;
  updateSW = registerSW({
    // Intentionally silent: the waiting SW activates on the next launch, no UI.
    onNeedRefresh() {},
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      swRegistration = registration;
      setInterval(() => void registration.update(), UPDATE_INTERVAL_MS);
    },
  });
}

/** Resolve once `worker` leaves the installing state, or after INSTALL_TIMEOUT_MS. */
function settleInstalling(worker: ServiceWorker): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = (): void => {
      worker.removeEventListener('statechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = (): void => {
      if (worker.state !== 'installing') done();
    };
    const timer = setTimeout(done, INSTALL_TIMEOUT_MS);
    worker.addEventListener('statechange', onChange);
  });
}

/** Resolve once a new worker controls the page, or after ACTIVATE_TIMEOUT_MS. */
function waitForControllerChange(): Promise<void> {
  if (!('serviceWorker' in navigator)) return Promise.resolve();
  const container = navigator.serviceWorker;
  return new Promise<void>((resolve) => {
    const done = (): void => {
      container.removeEventListener('controllerchange', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, ACTIVATE_TIMEOUT_MS);
    container.addEventListener('controllerchange', done);
  });
}

/**
 * Ask the server whether a newer build exists. Never throws: an offline or failing check
 * reports 'current', and the caller reloads regardless (the button must stay deterministic).
 */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const registration = swRegistration;
  if (!registration) return 'current';
  try {
    await registration.update();
  } catch {
    // Offline, or the SW script failed to fetch. Nothing to activate; the caller still reloads.
  }
  const { installing } = registration;
  if (installing) await settleInstalling(installing);
  return registration.waiting ? 'update-ready' : 'current';
}

/**
 * Activate the waiting worker and resolve once it controls the page. Skip-waiting goes through
 * the plugin's own updateSW() so the message shape always matches the generated worker's listener.
 */
export async function activateUpdate(): Promise<void> {
  if (!updateSW || !swRegistration?.waiting) return;
  const controlled = waitForControllerChange();
  await updateSW();
  await controlled;
}
