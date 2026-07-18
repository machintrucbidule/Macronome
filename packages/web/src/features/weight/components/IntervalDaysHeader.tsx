import { useTranslation } from 'react-i18next';
import type { IntervalDaysSummary } from '@macronome/shared';
import { kcal0, kg1, signed1 } from '../format';
import styles from './interval-days.module.css';

// Recap header of the interval-days popup (B-227): the interval's day counts + average kcal
// (server-computed) and, on a closed period, its weight change; then the macro-colour legend shown
// once. Every figure is server-derived or already on the Period DTO — the web only renders (rule 2).

export function IntervalDaysHeader({
  summary,
  weightEnd,
  delta,
}: {
  summary: IntervalDaysSummary;
  weightEnd: number | null;
  delta: number | null;
}) {
  const { t } = useTranslation();
  const start = weightEnd !== null && delta !== null ? weightEnd - delta : null;
  return (
    <div>
      <div className={styles.recap}>
        <span className={styles.recapFigures}>
          <strong>{summary.day_count}</strong> {t('weight.intervalDays.days')} ·{' '}
          <strong>{summary.logged_count}</strong> {t('weight.intervalDays.logged')}
          {summary.avg_kcal !== null && (
            <>
              {' · '}
              {t('weight.intervalDays.avg')} <strong>{kcal0(summary.avg_kcal)}</strong> kcal
            </>
          )}
        </span>
        {start !== null && weightEnd !== null && delta !== null && (
          <span className={styles.weight}>
            {kg1(start)} → {kg1(weightEnd)} kg
            <span className={styles.weightDelta}>({signed1(delta)})</span>
          </span>
        )}
      </div>
      <div className={styles.legend}>
        <span className={styles.lFat}>{t('weight.intervalDays.legendFat')}</span>
        <span className={styles.lCarb}>{t('weight.intervalDays.legendCarb')}</span>
        <span className={styles.lProt}>{t('weight.intervalDays.legendProt')}</span>
      </div>
    </div>
  );
}
