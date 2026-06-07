import { useTranslation } from 'react-i18next';
import styles from '../meals.module.css';

// Shown on a summary (light) day on Repas: the day carries only a calorie total, with no meal
// breakdown. Converting seeds the meals from the template so the user can log lines (day-model
// §9). Replaces the meal controls + scroller, which have nothing to act on for a summary day.
interface Props {
  onConvert: () => void;
}

export function SummaryDayPanel({ onConvert }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.summaryPanel}>
      <p>{t('meals.summary.hint')}</p>
      <button type="button" className={styles.addMeal} onClick={onConvert}>
        {t('meals.summary.convert')}
      </button>
    </div>
  );
}
