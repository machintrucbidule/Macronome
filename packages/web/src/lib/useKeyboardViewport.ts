import { useEffect, useState } from 'react';

// On-screen-keyboard awareness for the mobile search sheets (B-206). The virtual keyboard shrinks
// the *visual* viewport but not the layout viewport, and CSS `dvh`/`lvh`/`svh` don't track it — so a
// bottom-anchored sheet sized in `dvh` extends behind the keyboard, pushing its input/first results
// off-screen. This hook measures the keyboard's bottom overlap and publishes it as the CSS custom
// property `--kb-inset` on <html>, so the shared sheet geometry can subtract it (scrim bottom + sheet
// max-height). It also returns the px value for any JS consumer.
//
// Mirrors the useIsMobile/useIsStandalone conventions: guard non-browser environments (jsdom, any
// future SSR) so tests don't throw, and clean up subscriptions + the CSS var on unmount.
const KB_INSET_VAR = '--kb-inset';

function bottomInset(): number {
  if (typeof window === 'undefined' || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  // The overlap between the layout viewport bottom and the visible viewport bottom = the keyboard
  // (plus any bottom browser UI). Clamp to ≥0; sub-pixel rounding never goes negative that matters.
  return Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
}

/**
 * Subscribes to `window.visualViewport` and keeps the `--kb-inset` CSS variable on <html> in sync
 * with the on-screen keyboard's height (0 when closed). Returns the same value in px. No-op (returns
 * 0, writes nothing) where `visualViewport` is unavailable.
 */
export function useKeyboardViewport(): number {
  const [inset, setInset] = useState(bottomInset);

  useEffect(() => {
    const vv = typeof window === 'undefined' ? undefined : window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    const sync = (): void => {
      const next = bottomInset();
      setInset(next);
      root.style.setProperty(KB_INSET_VAR, `${next}px`);
    };
    // Re-sync on mount in case the keyboard opened between initial state and effect.
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
      // Reset so a later non-search sheet never inherits a stale inset.
      root.style.removeProperty(KB_INSET_VAR);
    };
  }, []);

  return inset;
}
