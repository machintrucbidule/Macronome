import { useTranslation } from 'react-i18next';
import styles from './meal-column.module.css';

// Desktop "⋯" meal menu — the dropdown counterpart of MealMenuSheet. Extracted from MealHeader
// when the header gained the 📋‹ copy button (CP-2/B-248) and crossed the per-function line cap.
//
// Order (MC-1/B-296, specifications/screens/meals.md §MealColumn): the two bulk actions first,
// then the moves, then rename + delete. The groups are separated with the `.sep` border the
// destructive row already used — no separator element, so the menu stays a flat list of buttons
// for the keyboard. The two bulk entries are DISABLED rather than dropped when they would change
// nothing, so the entries below never shift under the pointer (B-249 rule).
interface Props {
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canClearLines: boolean;
  canZeroLines: boolean;
  onClearLines: () => void;
  onZeroLines: () => void;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
}

export function MealMenuDropdown({
  canMoveLeft,
  canMoveRight,
  canClearLines,
  canZeroLines,
  onClearLines,
  onZeroLines,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.popmenu} role="menu">
      <button type="button" disabled={!canClearLines} onClick={onClearLines}>
        {t('meals.meal.clearLines')}
      </button>
      <button type="button" disabled={!canZeroLines} onClick={onZeroLines}>
        {t('meals.meal.zeroLines')}
      </button>
      <button type="button" className={styles.sep} disabled={!canMoveLeft} onClick={onMoveLeft}>
        {t('meals.meal.moveLeft')}
      </button>
      <button type="button" disabled={!canMoveRight} onClick={onMoveRight}>
        {t('meals.meal.moveRight')}
      </button>
      <button type="button" className={styles.sep} onClick={onRename}>
        {t('meals.meal.rename')}
      </button>
      <button type="button" className={styles.danger} onClick={onDelete}>
        {t('meals.meal.delete')}
      </button>
    </div>
  );
}
