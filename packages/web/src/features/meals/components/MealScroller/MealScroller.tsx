import type { Meal, Settings } from '@macronome/shared';
import { useIsMobile } from '../../../../lib/useIsMobile';
import { useSettingsQuery } from '../../../settings/useSettings';
import { MealColumn } from '../MealColumn/MealColumn';
import { DEFAULT_LINES_DESKTOP, DEFAULT_LINES_MOBILE } from '../../logic/lineRows';
import { useMealScroller } from './useMealScroller';
import { useMealSwipe } from '../../hooks/useMealSwipe';
import styles from '../../meals.module.css';

// Effective displayed-line floor (B-203): the user setting for this viewport, or the default while
// it loads. Extracted so the component itself stays simple.
function resolveMinLines(isMobile: boolean, settings: Settings | undefined): number {
  if (isMobile) return settings?.lines_mobile ?? DEFAULT_LINES_MOBILE;
  return settings?.lines_desktop ?? DEFAULT_LINES_DESKTOP;
}

// Horizontal meal scroller: integer-fit columns (logic/columnFit), overlay ‹ › arrows shown only
// on overflow, and a sticky custom scrollbar synced to the scroll position. View chrome only.
interface MealScrollerProps {
  meals: Meal[];
  // Index of the meal shown by the mobile meal-tab layer (S4); ≤560px CSS reveals only that
  // column. Ignored on desktop, where every column renders side by side.
  activeIndex: number;
  // Switch the active meal (S9): a mobile horizontal swipe on the meal area calls this. Desktop
  // never invokes it (the swipe handlers are only attached ≤560px).
  onSwitchMeal?: (index: number) => void;
}

export function MealScroller({ meals, activeIndex, onSwitchMeal }: MealScrollerProps) {
  const { scrollerRef, barRef, colWidth, bar, atStart, atEnd, sync, scrollBy, onThumbDown } =
    useMealScroller(meals);
  const isMobile = useIsMobile();
  // Configurable displayed-line floor (B-203), resolved by viewport and passed to every column.
  const minLines = resolveMinLines(isMobile, useSettingsQuery().data?.data);
  const swipe = useMealSwipe(isMobile && !!onSwitchMeal, (dir) => {
    const next = Math.min(Math.max(activeIndex + dir, 0), meals.length - 1);
    onSwitchMeal?.(next);
  });

  return (
    <div className={styles.scrollerWrap} {...swipe}>
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
            minLines={minLines}
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
