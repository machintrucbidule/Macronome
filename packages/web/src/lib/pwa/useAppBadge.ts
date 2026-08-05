import { useEffect } from 'react';
import type { DayTone } from '@macronome/shared';

// App-icon badge (B-262, design/components/pwa.md). While the app runs, the installed icon
// carries a plain dot whenever the current day is not compliant — including `none`, a day with
// nothing logged, which is exactly when the reminder earns its keep (owner decision).
//
// The badge CANNOT carry the verdict colour: `setAppBadge` takes only a number or a bare dot and
// the OS paints it in the system accent. The colour lives in the title-strip rule instead.
// Progressive enhancement — absent outside Chromium desktop, where this is a silent no-op.
//
// Known limitation, contracted: it only updates while the app is running, so an app closed all
// day still shows the last session's state.

interface BadgeNavigator {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

export function useAppBadge(tone: DayTone): void {
  useEffect(() => {
    const nav = navigator as Navigator & BadgeNavigator;
    if (typeof nav.setAppBadge !== 'function' || typeof nav.clearAppBadge !== 'function') return;
    // A rejected promise here is never actionable (permission/platform), so it is swallowed
    // rather than surfaced — a missing dot must not become a visible error.
    const done = tone === 'ok' ? nav.clearAppBadge() : nav.setAppBadge(); // no argument = the plain dot
    void done.catch(() => undefined);
  }, [tone]);
}
