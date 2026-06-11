import { registerSW } from 'virtual:pwa-register';

// Service-worker registration + the manual "force update" hook (PWA-1, ADR-0003).
// registerType is 'prompt' (vite.config.ts): a new build installs in the background and
// activates on the next launch — we deliberately show NO prompt and do NOT auto-reload
// mid-session. A periodic update() keeps long-lived sessions fetching new versions in the
// background. forceUpdate() (the Paramètres button) is the only place that activates now.

// Re-check for a new version this often while the app stays open (background fetch only;
// it still applies on next launch unless forceUpdate() is called).
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

/** Register the service worker once at startup. No-op when SW is unsupported (e.g. dev). */
export function registerServiceWorker(): void {
  if (updateSW) return;
  updateSW = registerSW({
    // Intentionally silent: the waiting SW activates on the next launch, no UI.
    onNeedRefresh() {},
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => void registration.update(), UPDATE_INTERVAL_MS);
    },
  });
}

/** Force a pending update to activate immediately and reload (Paramètres button). */
export async function forceUpdate(): Promise<void> {
  if (!updateSW) return;
  await updateSW(true);
}
