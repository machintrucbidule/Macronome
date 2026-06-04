import { useTranslation } from 'react-i18next';
import { currentYear } from '../format';
import styles from '../journal.module.css';

// Journal header (history.md): title + a year selector that scopes the list, with the day
// count. The journal API is per-year and there is no "available years" endpoint, so the
// selector is a stepper (◀ year ▶) defaulting to the current year — see M3c deviations.
interface JournalHeaderProps {
  year: number;
  dayCount: number;
  onYear: (year: number) => void;
}

export function JournalHeader({ year, dayCount, onYear }: JournalHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className={styles.head}>
      <h1 className={styles.title}>{t('journal.title')}</h1>
      <div className={styles.yearNav}>
        <button type="button" aria-label={t('journal.prevYear')} onClick={() => onYear(year - 1)}>
          ◀
        </button>
        <span className={styles.year}>{year}</span>
        <button
          type="button"
          aria-label={t('journal.nextYear')}
          disabled={year >= currentYear()}
          onClick={() => onYear(year + 1)}
        >
          ▶
        </button>
      </div>
      <span className={styles.count}>{t('journal.dayCount', { count: dayCount })}</span>
    </header>
  );
}
