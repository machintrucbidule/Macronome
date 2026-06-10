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
}

export function MealFooter({ mealId, totals }: MealFooterProps) {
  const { t } = useTranslation();
  const { actions } = useMeals();
  return (
    <div className={styles.foot}>
      <div className={styles.totalRow}>
        <div className={styles.restes}>
          <button
            type="button"
            className={styles.rbtn}
            onClick={() => actions.openLeftover(mealId)}
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
