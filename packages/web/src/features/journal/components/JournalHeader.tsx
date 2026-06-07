import { useTranslation } from 'react-i18next';
import { currentYear } from '../format';
import styles from '../journal.module.css';

// Journal header (history.md): title + a year selector that scopes the list, with the day
// count. The selector is a stepper (◀ year ▶) bounded to the years that actually contain
// data (B-067): ◀ stops at the earliest logged year, ▶ at the latest (which may be a future
// year when days are planned). The current year is always reachable even with no data.
interface JournalHeaderProps {
  year: number;
  dayCount: number;
  minYear: number | null;
  maxYear: number | null;
  onYear: (year: number) => void;
}

export function JournalHeader({ year, dayCount, minYear, maxYear, onYear }: JournalHeaderProps) {
  const { t } = useTranslation();
  const now = currentYear();
  const lower = Math.min(now, minYear ?? now);
  const upper = Math.max(now, maxYear ?? now);
  return (
    <header className={styles.head}>
      <h1 className={styles.title}>{t('journal.title')}</h1>
      <div className={styles.yearNav}>
        <button
          type="button"
          aria-label={t('journal.prevYear')}
          disabled={year <= lower}
          onClick={() => onYear(year - 1)}
        >
          ◀
        </button>
        <span className={styles.year}>{year}</span>
        <button
          type="button"
          aria-label={t('journal.nextYear')}
          disabled={year >= upper}
          onClick={() => onYear(year + 1)}
        >
          ▶
        </button>
      </div>
      <span className={styles.count}>{t('journal.dayCount', { count: dayCount })}</span>
    </header>
  );
}
