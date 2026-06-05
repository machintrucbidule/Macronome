import { useTranslation } from 'react-i18next';
import { currentYear } from '../format';
import styles from '../stats.module.css';

// Year selector (specifications/screens/stats.md): scopes the heatmap, monthly pivots and
// per-year key figures. A stepper (◀ year ▶) defaulting to the current year — there is no
// "available years" endpoint, same pattern as the Journal header.
interface YearSelectorProps {
  year: number;
  onYear: (year: number) => void;
}

export function YearSelector({ year, onYear }: YearSelectorProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.yearNav}>
      <button type="button" aria-label={t('stats.prevYear')} onClick={() => onYear(year - 1)}>
        ◀
      </button>
      <span className={styles.year}>{year}</span>
      <button
        type="button"
        aria-label={t('stats.nextYear')}
        disabled={year >= currentYear()}
        onClick={() => onYear(year + 1)}
      >
        ▶
      </button>
    </div>
  );
}
