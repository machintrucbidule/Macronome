import { useTranslation } from 'react-i18next';
import styles from './meal-column.module.css';

// Mobile one-tap photo entry button (QP-1/B-158): a 📷 with a small "+" badge that takes the slot
// of the (CSS-hidden ≤560px) 🍳 cook button in the meal header. Tapping opens the device camera; the
// camera→analyse→prefill wiring lives in useMealPhotoEntry. Presentational only.
interface MealPhotoButtonProps {
  busy: boolean;
  onClick: () => void;
}

export function MealPhotoButton({ busy, onClick }: MealPhotoButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.photoBtn}
      title={t('meals.photoEntry.button')}
      aria-label={t('meals.photoEntry.button')}
      disabled={busy}
      onClick={onClick}
    >
      📷
      <span className={styles.photoBadge} aria-hidden="true">
        +
      </span>
    </button>
  );
}
