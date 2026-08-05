import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { offsetFor, saveOffset, type NavKind } from './scroll-store';

// Scroll restoration (B-268). Mounted once in AppShell, which the layout route keeps alive across
// navigations (B-274). The app uses a plain <BrowserRouter>, not the data router, so react-router's
// own <ScrollRestoration> is unavailable without a rewrite.
//
// The offset is tracked continuously rather than read when leaving: by the time an effect runs the
// new route has already rendered, and a shorter document would have clamped window.scrollY.
export function useScrollRestoration(): void {
  const { key } = useLocation();
  const kind = useNavigationType() as NavKind;
  const lastY = useRef(0);
  const prevKey = useRef(key);

  useEffect(() => {
    const onScroll = (): void => {
      lastY.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (prevKey.current !== key) {
      saveOffset(prevKey.current, lastY.current);
      prevKey.current = key;
    }
    const target = offsetFor(key, kind);
    lastY.current = target;

    // The list re-renders its retained pages (the raised gcTime on the infinite queries) after this
    // effect, so the document may still be too short for the offset. Re-apply over a few frames
    // until it takes, then stop — never an open-ended loop.
    let frames = 0;
    let raf = 0;
    const apply = (): void => {
      if (window.scrollY !== target) window.scrollTo(0, target);
      if (target > 0 && window.scrollY < target && frames < 10) {
        frames += 1;
        raf = requestAnimationFrame(apply);
      }
    };
    apply();
    return () => cancelAnimationFrame(raf);
  }, [key, kind]);
}
