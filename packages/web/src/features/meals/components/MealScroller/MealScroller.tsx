import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import type { Meal } from '@macronome/shared';
import { columnFit } from '../../logic/columnFit';
import { MealColumn } from '../MealColumn/MealColumn';
import styles from '../../meals.module.css';

// Horizontal meal scroller: integer-fit columns (logic/columnFit), overlay ‹ › arrows shown only
// on overflow, and a sticky custom scrollbar synced to the scroll position. View chrome only.
interface MealScrollerProps {
  meals: Meal[];
}

interface Bar {
  overflow: boolean;
  thumbW: number;
  thumbL: number;
}

export function MealScroller({ meals }: MealScrollerProps) {
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
    const overflow = sw > cw + 2;
    const thumbW = overflow ? Math.max(40, (cw / sw) * track) : 40;
    const thumbL = overflow && sw > cw ? (sl / (sw - cw)) * (track - thumbW) : 0;
    setBar({ overflow, thumbW, thumbL: Number.isFinite(thumbL) ? thumbL : 0 });
    setAtStart(sl <= 4);
    setAtEnd(sl >= sw - cw - 4);
  }, []);

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

  return (
    <div className={styles.scrollerWrap}>
      {bar.overflow && !atStart && (
        <button
          type="button"
          className={`${styles.navArrow} ${styles.left}`}
          onClick={() => scrollBy(-1)}
        >
          ‹
        </button>
      )}
      {bar.overflow && !atEnd && (
        <button
          type="button"
          className={`${styles.navArrow} ${styles.right}`}
          onClick={() => scrollBy(1)}
        >
          ›
        </button>
      )}
      <div className={styles.scroller} ref={scrollerRef} onScroll={sync}>
        {meals.map((meal, i) => (
          // Scaffold meals share an empty id; key by order_index so React reconciles correctly
          // across the scaffold → materialized transition (otherwise duplicate keys leave stale columns).
          <MealColumn
            key={meal.id || `s${meal.order_index}`}
            meal={meal}
            index={i}
            meals={meals}
            width={colWidth}
          />
        ))}
      </div>
      {bar.overflow && (
        <div className={styles.hbar} ref={barRef}>
          <div
            className={styles.hthumb}
            style={{ width: bar.thumbW, left: bar.thumbL }}
            onMouseDown={onThumbDown}
          />
        </div>
      )}
    </div>
  );
}
