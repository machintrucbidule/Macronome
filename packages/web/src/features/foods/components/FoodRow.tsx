import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Stars } from '../../../components/RatingStars/Stars';
import { tableStyles } from '../../../components/DataTable/SortableTh';
import { gramsDisplay, kcalDisplay, portionSummary } from '../format';
import styles from '../foods.module.css';

// One food row in the Aliments table (specifications/screens/food-db.md). Click opens
// the edit modal; the hover icon archives (or restores an archived row).
interface FoodRowProps {
  food: Food;
  onOpen: (food: Food) => void;
  onArchive: (food: Food) => void;
  onRestore: (food: Food) => void;
}

export function FoodRow({ food, onOpen, onArchive, onRestore }: FoodRowProps) {
  const { t } = useTranslation();
  const archived = food.archived_at !== null;
  const portions = portionSummary(food.named_portions);
  return (
    <tr
      className={`${styles.row} ${tableStyles.clickable} ${archived ? tableStyles.archived : ''}`}
      onClick={() => onOpen(food)}
      // Context-menu row id (B-195): resolved by useFoodsContextMenu.
      data-food={food.id}
    >
      <td>
        <span className={tableStyles.nameLabel} title={food.name}>
          {food.name}
        </span>
        {food.comment && <div className={styles.comment}>{food.comment}</div>}
      </td>
      <td className={tableStyles.num}>{kcalDisplay(food.kcal_per_100g)}</td>
      <td className={`${tableStyles.numc} ${styles.mFat}`}>{gramsDisplay(food.fat_per_100g)}</td>
      <td className={`${tableStyles.numc} ${styles.mCarb}`}>{gramsDisplay(food.carb_per_100g)}</td>
      <td className={`${tableStyles.numc} ${styles.mProt}`}>
        {gramsDisplay(food.protein_per_100g)}
      </td>
      {/* B-284: unbounded free text in a declared-width column — truncated, full value on hover. */}
      <td className={styles.portion} title={portions}>
        {portions}
      </td>
      <td className={tableStyles.numc}>
        <Stars rating={food.rating} />
      </td>
      <td className={styles.vis}>
        <span className={`${styles.vistag} ${food.visibility === 'shared' ? styles.shared : ''}`}>
          {t(`foods.visibility.${food.visibility}`)}
        </span>
      </td>
      <td className={tableStyles.numc}>{food.usage ?? ''}</td>
      <td>
        <button
          type="button"
          className={styles.iconbtn}
          title={archived ? t('foods.restore') : t('foods.archive')}
          onClick={(e) => {
            e.stopPropagation();
            if (archived) onRestore(food);
            else onArchive(food);
          }}
        >
          {archived ? '↺' : '🗑'}
        </button>
      </td>
    </tr>
  );
}
