import type { Meal } from '@macronome/shared';
import { MealColumn } from '../MealColumn/MealColumn';
import { useMealScroller } from './useMealScroller';
import styles from '../../meals.module.css';

// Horizontal meal scroller: integer-fit columns (logic/columnFit), overlay ‹ › arrows shown only
// on overflow, and a sticky custom scrollbar synced to the scroll position. View chrome only.
interface MealScrollerProps {
  meals: Meal[];
  // Index of the meal shown by the mobile meal-tab layer (S4); ≤560px CSS reveals only that
  // column. Ignored on desktop, where every column renders side by side.
  activeIndex: number;
}

export function MealScroller({ meals, activeIndex }: MealScrollerProps) {
  const { scrollerRef, barRef, colWidth, bar, atStart, atEnd, sync, scrollBy, onThumbDown } =
    useMealScroller(meals);

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
            active={i === activeIndex}
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
