import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { MealTotals } from '@macronome/shared';
import { useMeals } from '../../MealsContext';
import { r0 } from '../../format';
import styles from './meal-column.module.css';

// Footer total row: the leftover (⊟ Restes) trigger + the meal's consumed weight and macro
// totals (server-computed). Reuses the line grid so columns align with the lines above.
interface MealFooterProps {
  mealId: string;
  totals: MealTotals;
  // Eligible line ids of this meal (B-207): selecting the footer selects them all.
  entryIds: string[];
}

export function MealFooter({ mealId, totals, entryIds }: MealFooterProps) {
  const { t } = useTranslation();
  const { actions, selection } = useMeals();
  // Selection-sum (B-207): clicking a meal footer toggles the whole meal; Ctrl/⌘-click enters the
  // mode first. Desktop-only feature (the footer is not tappable-to-select on mobile — the controls
  // bar that hosts the Σ mode is hidden there — so a footer click only acts while mode is on / Ctrl).
  const onFooterClick = (e: MouseEvent): void => {
    if (entryIds.length === 0) return;
    if (e.ctrlKey || e.metaKey) {
      if (!selection.mode) selection.enter();
      selection.toggleMeal(entryIds);
    } else if (selection.mode) selection.toggleMeal(entryIds);
  };
  const selected = selection.allSelected(entryIds);
  const selectable = selection.mode && entryIds.length > 0;
  return (
    <div className={styles.foot}>
      <div
        className={[
          styles.totalRow,
          selected ? styles.footSelected : '',
          selectable ? styles.footSelectable : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={onFooterClick}
      >
        <div className={styles.restes}>
          <button
            type="button"
            className={styles.rbtn}
            onClick={(e) => {
              e.stopPropagation(); // don't toggle meal selection (B-207)
              actions.openLeftover(mealId);
            }}
          >
            ⊟ {t('meals.leftover.button')}
          </button>
          <span className={styles.tlabel}>{t('meals.total')}</span>
        </div>
        <span className={styles.wt}>{r0(totals.weight_g)} g</span>
        <span className={styles.footV}>{r0(totals.kcal)}</span>
        {/* L/G/P totals colour-coded like the per-line macros + the totals dots (owner-approved
            desktop change, 2026-06-11); kcal stays its colour. */}
        <span className={`${styles.footV} ${styles.fat}`}>{r0(totals.fat)}</span>
        <span className={`${styles.footV} ${styles.carb}`}>{r0(totals.carb)}</span>
        <span className={`${styles.footV} ${styles.prot}`}>{r0(totals.protein)}</span>
        <span />
        <span />
      </div>
    </div>
  );
}
