import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/Modal/Modal';
import styles from './meal-menu-sheet.module.css';

// Mobile-only meal "⋯" menu as a bottom sheet (owner decision 2026-06-11): the desktop dropdown
// (rename / move / delete) is replaced on phones by this sheet, which sits above the bottom nav and
// also carries **Gérer les restes** (the footer ⊟ Restes button is hidden on mobile). Rendered only
// when useIsMobile() (MealHeader gates it), so desktop is untouched. Cook mode 🍳 is dropped on
// mobile, so it is absent here.
interface Props {
  name: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onRename: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onLeftover: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function MealMenuSheet({
  name,
  canMoveLeft,
  canMoveRight,
  onRename,
  onMoveLeft,
  onMoveRight,
  onLeftover,
  onDelete,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const act = (fn: () => void) => (): void => {
    onClose();
    fn();
  };

  return (
    <Modal title={name} mobile="sheet" size="confirm" onClose={onClose}>
      <div className={styles.menu}>
        <button type="button" className={styles.item} onClick={act(onRename)}>
          {t('meals.meal.rename')}
        </button>
        <button type="button" className={styles.item} onClick={act(onLeftover)}>
          {t('meals.meal.manageLeftover')}
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
        <button type="button" className={`${styles.item} ${styles.danger}`} onClick={act(onDelete)}>
          {t('meals.meal.delete')}
        </button>
      </div>
    </Modal>
  );
}
