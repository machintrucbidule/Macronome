import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/Modal/Modal';
import styles from './meal-menu-sheet.module.css';

// Mobile-only meal "⋯" menu as a bottom sheet (owner decision 2026-06-11): the desktop dropdown
// (rename / move / delete) is replaced on phones by this sheet, which sits above the bottom nav.
// Rendered only when useIsMobile() (MealHeader gates it), so desktop is untouched. Cook mode is
// dropped on mobile, so it is absent here; the ⊟ Restes button stays in the meal footer (it is not
// folded into this menu — owner correction 2026-06-11).
//
// Order (MC-1/B-296, D3): the copy stays FIRST — it is the entry this sheet was built around —
// then the two bulk actions, then the moves, then rename + delete. Every row already draws its own
// bottom border, so the grouping needs no extra separator here.
interface Props {
  name: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  canClearLines: boolean;
  canZeroLines: boolean;
  /** Copier le repas de la veille (CP-2/B-248) — the header button's mobile home. */
  onCopyYesterday: () => void;
  onClearLines: () => void;
  onZeroLines: () => void;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function MealMenuSheet({
  name,
  canMoveLeft,
  canMoveRight,
  canClearLines,
  canZeroLines,
  onCopyYesterday,
  onClearLines,
  onZeroLines,
  onRename,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const act = (fn: () => void) => (): void => {
    onClose();
    fn();
  };

  return (
    <Modal title={name} size="confirm" onClose={onClose}>
      <div className={styles.menu}>
        <button type="button" className={styles.item} onClick={act(onCopyYesterday)}>
          {t('meals.copyMeal.action')}
        </button>
        <button
          type="button"
          className={styles.item}
          disabled={!canClearLines}
          onClick={act(onClearLines)}
        >
          {t('meals.meal.clearLines')}
        </button>
        <button
          type="button"
          className={styles.item}
          disabled={!canZeroLines}
          onClick={act(onZeroLines)}
        >
          {t('meals.meal.zeroLines')}
        </button>
        <button
          type="button"
          className={styles.item}
          disabled={!canMoveLeft}
          onClick={act(onMoveLeft)}
        >
          {t('meals.meal.moveLeft')}
        </button>
        <button
          type="button"
          className={styles.item}
          disabled={!canMoveRight}
          onClick={act(onMoveRight)}
        >
          {t('meals.meal.moveRight')}
        </button>
        <button type="button" className={styles.item} onClick={act(onRename)}>
          {t('meals.meal.rename')}
        </button>
        <button type="button" className={`${styles.item} ${styles.danger}`} onClick={act(onDelete)}>
          {t('meals.meal.delete')}
        </button>
      </div>
    </Modal>
  );
}
