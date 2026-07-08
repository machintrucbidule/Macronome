import { useTranslation } from 'react-i18next';
import type { WeightRecord, WeightRecords as WeightRecordsData } from '@macronome/shared';
import { MetricCard } from '../../../components/MetricCard/MetricCard';
import { formatDate } from '../format';
import styles from '../stats.module.css';

// Weight records (specifications/screens/stats.md §E, spec/logic/stats-adherence.md §9, B-197):
// four server-computed cards — highest & lowest weigh-in over all data + over the selected
// year, each with its weigh-in date. The web only renders the server values.
function RecordCard({
  label,
  record,
  locale,
}: {
  label: string;
  record: WeightRecord | null;
  locale: string;
}) {
  return (
    <MetricCard
      label={label}
      value={record ? record.weight_kg.toFixed(1) : '—'}
      {...(record ? { unit: 'kg', note: formatDate(record.date, locale) } : {})}
    />
  );
}

export function WeightRecords({ data, year }: { data: WeightRecordsData; year: number }) {
  const { t, i18n } = useTranslation();
  const loc = i18n.language;
  return (
    <div className={styles.keys}>
      <RecordCard label={t('stats.record.highestAll')} record={data.all.high} locale={loc} />
      <RecordCard label={t('stats.record.lowestAll')} record={data.all.low} locale={loc} />
      <RecordCard
        label={t('stats.record.highestYear', { year })}
        record={data.year.high}
        locale={loc}
      />
      <RecordCard
        label={t('stats.record.lowestYear', { year })}
        record={data.year.low}
        locale={loc}
      />
    </div>
  );
}
