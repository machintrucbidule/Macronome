import { useTranslation } from 'react-i18next';
import styles from './meal-column.module.css';

// "Copier le repas de la veille" header button (CP-2/B-248): the 📋 clipboard with a small "‹"
// badge ("the previous one"), in the exact .cookBtn box immediately RIGHT of the cook button
// (ICON-1/B-281 put cook first). Hidden ≤560px by the same CSS rule that hides it — on a phone the
// action lives in the meal ⋯ sheet. Sibling of MealPhotoButton, whose "+" badge *geometry* it
// reuses — but not its colours: this badge is neutral grey (B-282), the photo one stays accent.
export function CopyMealButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={styles.copyBtn}
      title={t('meals.copyMeal.action')}
      aria-label={t('meals.copyMeal.action')}
      onClick={onClick}
    >
      <span className={styles.copyIcon}>
        📋
        <span className={styles.copyBadge} aria-hidden="true">
          ‹
        </span>
      </span>
    </button>
  );
}
