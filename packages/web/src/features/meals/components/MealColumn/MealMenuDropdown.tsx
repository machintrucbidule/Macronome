import { useTranslation } from 'react-i18next';
import styles from './meal-column.module.css';

// Desktop "⋯" meal menu (rename / move / delete) — the dropdown counterpart of MealMenuSheet.
// Extracted from MealHeader when the header gained the 📋‹ copy button (CP-2/B-248) and crossed
// the per-function line cap; the markup is unchanged, so desktop renders exactly as before.
interface Props {
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
}

export function MealMenuDropdown({
  canMoveLeft,
  canMoveRight,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.popmenu} role="menu">
      <button type="button" onClick={onRename}>
        {t('meals.meal.rename')}
      </button>
      <button type="button" disabled={!canMoveLeft} onClick={onMoveLeft}>
        {t('meals.meal.moveLeft')}
      </button>
      <button type="button" disabled={!canMoveRight} onClick={onMoveRight}>
        {t('meals.meal.moveRight')}
      </button>
      <button type="button" className={styles.danger} onClick={onDelete}>
        {t('meals.meal.delete')}
      </button>
    </div>
  );
}
