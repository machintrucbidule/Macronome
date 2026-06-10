import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Meal } from '@macronome/shared';
import { r0 } from '../format';
import styles from './MealTabs.module.css';

// Mobile-only meal-tab bar (mobile-responsive S4, spec §5.3). Pinned directly above the bottom
// nav (thumb zone); one two-line segment per meal (name + its kcal total), the active one in
// `--accent`. The segments share the full width (equal flex) and the band scrolls horizontally
// only when they overflow (≈5+ meals), keeping the active tab in view. `display:none` ≥561px —
// absent from the desktop layout + a11y tree (desktop byte-identical). The bar only switches
// which meal is shown; every meal column stays mounted (CSS hides the inactive ones).
interface MealTabsProps {
  meals: Meal[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function MealTabs({ meals, activeIndex, onSelect }: MealTabsProps) {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active tab in view when it changes (and when the band overflows).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [activeIndex]);

  return (
    <nav className={styles.tabs} aria-label={t('meals.tabs.aria')}>
      {meals.map((meal, i) => {
        const active = i === activeIndex;
        const kcal = r0(meal.totals.kcal);
        const cls = [styles.tab, active && styles.active, kcal === 0 && styles.empty]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            // Scaffold meals share an empty id; key by order_index so the active tab survives the
            // scaffold → materialized transition (mirrors MealScroller's keying).
            key={meal.id || `s${meal.order_index}`}
            ref={active ? activeRef : undefined}
            type="button"
            className={cls}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(i)}
          >
            <span className={styles.name}>{meal.slot_name}</span>
            <span className={styles.kcal}>{t('meals.tabs.kcal', { value: kcal })}</span>
          </button>
        );
      })}
    </nav>
  );
}
