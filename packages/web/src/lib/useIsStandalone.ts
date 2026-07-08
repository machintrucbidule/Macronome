import { useEffect, useState } from 'react';

// Installed-app signal (B-195): true when the app runs in its own window (the PWA
// installed via the manifest), false in a browser tab. Mirrors useIsMobile's
// matchMedia-subscribe pattern; the one-shot isStandalone() helper in
// lib/pwa/useInstallPrompt.ts stays for its install-button use.
// B-200: the installed window may run in `window-controls-overlay` (display_override) rather
// than `standalone`, so match both — WCO is still an installed window (keeps B-195 etc. active).
const STANDALONE_QUERY = '(display-mode: standalone), (display-mode: window-controls-overlay)';

function matchesStandalone(): boolean {
  // Client-only SPA; guard so non-browser environments (jsdom in component tests,
  // any future SSR) resolve to browser-tab instead of throwing.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(STANDALONE_QUERY).matches;
}

export function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(matchesStandalone);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(STANDALONE_QUERY);
    const onChange = (): void => setStandalone(mql.matches);
    // Re-sync on mount in case the display mode changed between initial state and effect.
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return standalone;
}
