import { useTranslation } from 'react-i18next';
import type { Period } from '@macronome/shared';
import { kg1, orDash, signed1, signedKcal0 } from '../format';
import { signTone, type Tone } from '../period-style';
import wstyles from '../weight.module.css';
import styles from '../weight-mobile.module.css';

// One compact period row for the mobile list (mobile-responsive S8, mockups/04-weight.html).
// Shows only the four at-a-glance figures (période/durée · Poids · Δ · Déficit/j + chevron);
// Δ and Déficit are tinted with the existing WV-1/B-115 trend tones (reused, never recomputed —
// CLAUDE.md rule 2). Tapping opens the full detail sheet. Two rows for phone width.
const toneClass = (tone: Tone): string =>
  (tone === 'pos' ? wstyles.pos : tone === 'neg' ? wstyles.neg : '') ?? '';

export function PeriodListRow({ period, onOpen }: { period: Period; onOpen: () => void }) {
  const { t } = useTranslation();
  // The open interval (B-176) ends at "today" and dashes the end-weight figures (Poids, Δ).
  const end = period.open ? t('weight.today') : period.end_date;
  return (
    <button type="button" className={styles.row} data-period={period.end_date} onClick={onOpen}>
      <div className={styles.head}>
        <span className={styles.period}>
          <span className={styles.periodRange}>{`${period.start_date} → ${end}`}</span>
          <span className={styles.periodSub}>
            {t('weight.detail.daysShort', { count: period.days })}
          </span>
        </span>
        <span className={styles.chev} aria-hidden="true">
          ›
        </span>
      </div>
      <div className={styles.metrics}>
        <span className={styles.v}>
          <span className={styles.k}>{t('weight.col.weight')}</span>
          {orDash(period.weight_end, kg1)}
        </span>
        <span
          className={`${styles.v} ${period.delta === null ? '' : toneClass(signTone(period.delta))}`}
        >
          <span className={styles.k}>{t('weight.col.delta')}</span>
          {orDash(period.delta, signed1)}
        </span>
        <span
          className={`${styles.v} ${period.deficit_per_day === null ? '' : toneClass(signTone(period.deficit_per_day))}`}
        >
          <span className={styles.k}>{t('weight.col.deficit')}</span>
          {orDash(period.deficit_per_day, signedKcal0)}
        </span>
      </div>
    </button>
  );
}
