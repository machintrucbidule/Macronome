import { useEffect, useState } from 'react';

// Phone breakpoint, kept in sync with `--bp-phone` (tokens.css) and every
// `@media (max-width: 560px)` rule (mobile-responsive spec §0). A custom property
// can't be referenced in a media-query condition, so the literal lives here too.
const PHONE_QUERY = '(max-width: 560px)';

function matchesPhone(): boolean {
  // Client-only SPA; guard so non-browser environments (jsdom in component tests,
  // any future SSR) resolve to desktop instead of throwing.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(PHONE_QUERY).matches;
}

// Render-switch / overlay-variant signal: true ≤560px, false above. The single source
// of truth for "is this the phone layout" across the app (Modal mobile variants, the
// list table↔cards switches, the mobile shell). Subscribes to viewport changes.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(matchesPhone);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(PHONE_QUERY);
    const onChange = (): void => setIsMobile(mql.matches);
    // Re-sync on mount in case the viewport changed between initial state and effect.
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
