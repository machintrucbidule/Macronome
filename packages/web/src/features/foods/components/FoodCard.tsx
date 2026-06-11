import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Stars } from '../../../components/RatingStars/Stars';
import { gramsDisplay, kcalDisplay, portionSummary } from '../format';
import styles from '../foods-mobile.module.css';

// One food card in the Aliments mobile list (mobile-responsive S7, spec §4.3). Spec-strict
// content (owner): name + rating, kcal/100g + L·G·P macros, portion. The whole card is a tap
// target opening the full-screen food sheet (edit). It renders display values; it never computes.
interface FoodCardProps {
  food: Food;
  onOpen: (food: Food) => void;
}

export function FoodCard({ food, onOpen }: FoodCardProps) {
  const { t } = useTranslation();
  const archived = food.archived_at !== null;
  return (
    <button
      type="button"
      className={`${styles.card} ${archived ? styles.archived : ''}`}
      data-food={food.id}
      onClick={() => onOpen(food)}
    >
      <div className={styles.top}>
        <span className={styles.name} title={food.name}>
          {food.name}
        </span>
        <span className={styles.topRight}>
          {archived && <span className={styles.archivedTag}>{t('foods.archivedTag')}</span>}
          <Stars rating={food.rating} />
        </span>
      </div>

      <div className={styles.row}>
        <span className={styles.kcal}>
          {kcalDisplay(food.kcal_per_100g)} <small>{t('foods.col.kcal')}</small>
        </span>
        <span className={styles.macros}>
          <span className={styles.mFat}>{gramsDisplay(food.fat_per_100g)}</span>
          <span className={styles.mCarb}>{gramsDisplay(food.carb_per_100g)}</span>
          <span className={styles.mProt}>{gramsDisplay(food.protein_per_100g)}</span>
          <span className={styles.macroLegend}>L·G·P</span>
        </span>
      </div>

      <div className={styles.portion}>
        <span className={styles.portionLabel}>{t('foods.col.portion')}</span>
        <span className={styles.portionValue}>{portionSummary(food.named_portions)}</span>
      </div>

      {/* Usage count shown only when the list is usage-sorted (FU-1/B-151), mirroring the
          desktop column; the default spec-strict card content is unchanged otherwise. */}
      {food.usage !== undefined && (
        <div className={styles.portion}>
          <span className={styles.portionLabel}>{t('foods.col.usage')}</span>
          <span className={styles.portionValue}>{food.usage}</span>
        </div>
      )}
    </button>
  );
}
