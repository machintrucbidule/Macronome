import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { offsetFor, saveOffset } from './scroll-store';

// Scroll restoration (B-268, corrected by B-277). Mounted once in AppShell, which the layout route
// keeps alive across navigations (B-274). The app uses a plain <BrowserRouter>, not the data
// router, so react-router's own <ScrollRestoration> is unavailable without a rewrite.
//
// The offset is tracked continuously rather than read when leaving: by the time an effect runs the
// new route has already rendered, and a shorter document would have clamped window.scrollY.

/** How long to keep re-applying the offset while the screen assembles itself. */
const RESTORE_BUDGET_MS = 2000;

export function useScrollRestoration(): void {
  const { pathname } = useLocation();
  const lastY = useRef(0);
  const prevPath = useRef(pathname);

  useEffect(() => {
    const onScroll = (): void => {
      lastY.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (prevPath.current !== pathname) {
      saveOffset(prevPath.current, lastY.current);
      prevPath.current = pathname;
    }
    const target = offsetFor(pathname);
    lastY.current = target;
    if (window.scrollY !== target) window.scrollTo(0, target);
    if (target === 0) return;

    // The screen is not there yet: its code chunk is fetched on demand (B-266) and its data
    // arrives after that, so the document is briefly far too short for the offset — the browser
    // would clamp the scroll and drop us near the top. Re-apply while the page grows, bounded by
    // a deadline so this can never become an open-ended loop.
    const deadline = performance.now() + RESTORE_BUDGET_MS;
    let raf = 0;
    const reapply = (): void => {
      if (window.scrollY >= target || performance.now() > deadline) return;
      window.scrollTo(0, target);
      raf = requestAnimationFrame(reapply);
    };
    raf = requestAnimationFrame(reapply);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
}
