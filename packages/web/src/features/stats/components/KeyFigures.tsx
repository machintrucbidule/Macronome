import { useTranslation } from 'react-i18next';
import type { KeyFigures as KeyFiguresData } from '@macronome/shared';
import { MetricCard } from '../../../components/MetricCard/MetricCard';
import { monthKeyLabel, pct } from '../format';
import styles from '../stats.module.css';

// Adherence key figures (spec/logic/stats-adherence.md §6): year OK rate, overall OK rate,
// current OK streak, best month. Server-computed; rendered as derived-value tiles.
export function KeyFigures({ data }: { data: KeyFiguresData }) {
  const { t, i18n } = useTranslation();
  const best = data.best_month;
  return (
    <div className={styles.keys}>
      <MetricCard label={t('stats.key.yearOk')} value={pct(data.year_ok_rate)} />
      <MetricCard label={t('stats.key.overallOk')} value={pct(data.overall_ok_rate)} />
      <MetricCard
        label={t('stats.key.streak')}
        value={data.current_ok_streak}
        unit={t('stats.key.days')}
      />
      <MetricCard
        label={t('stats.key.bestMonth')}
        value={best ? monthKeyLabel(best.month, i18n.language) : '—'}
        note={best ? t('stats.key.bestMonthNote', { rate: pct(best.ok_rate) }) : undefined}
      />
    </div>
  );
}
