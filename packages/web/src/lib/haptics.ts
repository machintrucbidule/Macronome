// Light haptic feedback (PWA-1/B-144). A guarded wrapper over navigator.vibrate, fired on
// a couple of key successes (adding a Repas entry, applying an AI proposal). Silently no-ops
// where unsupported — desktop and iOS Safari expose no Vibration API — so callers never guard.

/** Vibrate for `ms` (default a short tap). Safe no-op when the Vibration API is absent. */
export function tap(ms = 12): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(ms);
  } catch {
    // Some browsers throw if called outside a user gesture; feedback is non-essential.
  }
}
