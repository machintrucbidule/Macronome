import { useTranslation } from 'react-i18next';
import { ACTIVITY_LABEL_KEYS, type ActivityLevel, type JournalRow as Row } from '@macronome/shared';
import { formatDow, formatJournalDate, r0 } from '../format';
import styles from '../journal-mobile.module.css';

// One Journal day as a mobile card (mobile-responsive S5, mockups/02-journal.html): a
// scannable summary — date + day-of-week, the calorie total, the verdict, the L·G·P macros,
// activity and comment. Display-only and tappable as a whole (the verdict shows as a static
// pill, not the interactive badge); tapping opens the day-editor sheet. Mirrors the desktop
// row's data and state band but never computes — it renders the server-provided JournalRow.
const DASH = '—';

const STATE_CLASS: Record<Row['state'], string | undefined> = {
  green: styles.green,
  yellow: styles.yellow,
  red: styles.red,
  none: undefined,
};

const VERDICT_CLASS = {
  OK: styles.badgeOk,
  NOK: styles.badgeNok,
} as const;

interface JournalCardProps {
  row: Row;
  onOpen: (row: Row) => void;
}

export function JournalCard({ row, onOpen }: JournalCardProps) {
  const { t, i18n } = useTranslation();
  const verdict = row.effective_verdict;

  return (
    <button
      type="button"
      className={`${styles.card} ${STATE_CLASS[row.state] ?? ''}`}
      data-date={row.date}
      onClick={() => onOpen(row)}
    >
      <div className={styles.top}>
        <div className={styles.day}>
          <span className={styles.date}>{formatJournalDate(row.date, i18n.language)}</span>
          <span className={styles.dow}>{formatDow(row.date, i18n.language)}</span>
        </div>
        <span className={`${styles.badge} ${verdict ? VERDICT_CLASS[verdict] : styles.badgeMuted}`}>
          {verdict ?? DASH}
        </span>
      </div>

      <div className={styles.row}>
        <span className={styles.kcal}>
          {row.kcal > 0 ? r0(row.kcal) : DASH} <small>kcal</small>
        </span>
        {row.macros ? (
          <span className={styles.macros}>
            <span className={styles.mFat}>{r0(row.macros.L)}</span>
            <span className={styles.mCarb}>{r0(row.macros.G)}</span>
            <span className={styles.mProt}>{r0(row.macros.P)}</span>
            <span className={styles.macroLegend}>L·G·P</span>
          </span>
        ) : (
          <span className={styles.dash}>{DASH}</span>
        )}
      </div>

      <div className={styles.meta}>
        <span className={styles.metaKey}>{t('journal.col.activity')}</span>
        <b>{t(ACTIVITY_LABEL_KEYS[row.activity_level as ActivityLevel].label)}</b>
      </div>

      {row.comment && <div className={styles.comment}>« {row.comment} »</div>}
    </button>
  );
}
