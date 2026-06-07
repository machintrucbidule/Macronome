import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Meal } from '@macronome/shared';
import { columnFit, hasOverflow } from '../../logic/columnFit';

// Imperative chrome state for the meal scroller: integer-fit column width, overflow flag (arrows +
// custom scrollbar), scroll-position thumb, and the drag handler. View-only geometry — no domain.
interface Bar {
  overflow: boolean;
  thumbW: number;
  thumbL: number;
}

export function useMealScroller(meals: Meal[]) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [colWidth, setColWidth] = useState(400);
  const [bar, setBar] = useState<Bar>({ overflow: false, thumbW: 40, thumbL: 0 });
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback((): void => {
    const sc = scrollerRef.current;
    const track = barRef.current?.clientWidth ?? 0;
    if (!sc) return;
    const { scrollWidth: sw, clientWidth: cw, scrollLeft: sl } = sc;
    // Gate the chrome on a DOM-free, integer test (B-075): genuine overflow ⇔ more meals than the
    // integer-fit columns. Reading scrollWidth here over-triggered on the floor/border residual.
    const overflow = hasOverflow(cw, meals.length);
    const thumbW = overflow ? Math.max(40, (cw / sw) * track) : 40;
    const thumbL = overflow && sw > cw ? (sl / (sw - cw)) * (track - thumbW) : 0;
    setBar({ overflow, thumbW, thumbL: Number.isFinite(thumbL) ? thumbL : 0 });
    setAtStart(sl <= 4);
    setAtEnd(sl >= sw - cw - 4);
  }, [meals.length]);

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    const measure = (): void => {
      setColWidth(columnFit(sc.clientWidth).colWidth);
      sync();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    return () => ro.disconnect();
  }, [sync, meals.length]);

  const scrollBy = (dir: 1 | -1): void =>
    scrollerRef.current?.scrollBy({ left: dir * colWidth, behavior: 'smooth' });

  const onThumbDown = (e: ReactMouseEvent): void => {
    e.preventDefault();
    const sc = scrollerRef.current;
    const track = barRef.current?.clientWidth ?? 0;
    if (!sc) return;
    const startX = e.clientX;
    const startLeft = sc.scrollLeft;
    const move = (ev: MouseEvent): void => {
      const { scrollWidth: sw, clientWidth: cw } = sc;
      sc.scrollLeft = startLeft + ((ev.clientX - startX) * (sw - cw)) / (track - bar.thumbW);
    };
    const up = (): void => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return { scrollerRef, barRef, colWidth, bar, atStart, atEnd, sync, scrollBy, onThumbDown };
}
