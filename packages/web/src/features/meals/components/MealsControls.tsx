import { useTranslation } from 'react-i18next';
import styles from '../meals.module.css';

// Controls row above the meal scroller: usage hint, Copier hier (B-082), Tout effacer (B-046),
// and + Repas. Kept out of MealsPage so the page stays a thin route container. Add-meal uses
// prompt().
interface Props {
  onClear: () => void;
  onCopyYesterday: () => void;
  onAddMeal: (name: string) => void;
}

export function MealsControls({ onClear, onCopyYesterday, onAddMeal }: Props) {
  const { t } = useTranslation();

  const promptAddMeal = (): void => {
    const name = window.prompt(t('meals.meal.addPrompt'));
    if (name) onAddMeal(name);
  };

  return (
    <div className={styles.controls}>
      <span className={styles.hint}>{t('meals.hint')}</span>
      <button type="button" className={styles.copyDay} onClick={onCopyYesterday}>
        {t('meals.copyYesterday')}
      </button>
      <button type="button" className={styles.clearAll} onClick={onClear}>
        {t('meals.clearAll')}
      </button>
      <button type="button" className={styles.addMeal} onClick={promptAddMeal}>
        {t('meals.addMeal')}
      </button>
    </div>
  );
}
