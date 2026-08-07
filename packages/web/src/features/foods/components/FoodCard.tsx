import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Stars } from '../../../components/RatingStars/Stars';
import { SelectCheckbox } from '../../../components/BulkEdit';
import { gramsDisplay, kcalDisplay, portionSummary } from '../format';
import styles from '../foods-mobile.module.css';

// One food card in the Aliments mobile list (mobile-responsive S7, spec §4.3). Spec-strict
// content (owner): name + rating, kcal/100g + L·G·P macros, portion. The card body is a tap
// target opening the bottom-sheet food editor (edit). It renders display values; it never computes.
//
// BE-1: the root is no longer the button — a batch-selection checkbox cannot be nested inside one.
// It wraps a full-area button plus the box, which sits bottom-right and stays faint until used.
interface FoodCardProps {
  food: Food;
  selected: boolean;
  onToggle: (id: string) => void;
  onOpen: (food: Food) => void;
}

export function FoodCard({ food, selected, onToggle, onOpen }: FoodCardProps) {
  const { t } = useTranslation();
  const archived = food.archived_at !== null;
  return (
    <div
      className={`${styles.card} ${archived ? styles.archived : ''} ${
        selected ? styles.cardSelected : ''
      }`}
      data-food={food.id}
    >
      <button type="button" className={styles.cardBody} onClick={() => onOpen(food)}>
        <div className={styles.top}>
          <span className={styles.name} title={food.name}>
            {food.name}
          </span>
          <span className={styles.topRight}>
            {archived && <span className={styles.archivedTag}>{t('foods.archivedTag')}</span>}
            {/* Provenance (B-291) — the desktop table's Source column, folded into the card. */}
            <span className={styles.archivedTag}>{t(`foods.source.${food.source}`)}</span>
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
      <SelectCheckbox
        variant="card"
        checked={selected}
        onChange={() => onToggle(food.id)}
        ariaLabel={t('bulk.selectRow', { name: food.name })}
      />
    </div>
  );
}
