import { useTranslation } from 'react-i18next';
import type { AdherenceResponse } from '@macronome/shared';
import { Heatmap } from '../../../components/Chart/Heatmap';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { KeyFigures } from './KeyFigures';
import { MonthCalorieBars } from './MonthCalorieBars';
import { MonthlyBars } from './MonthlyBars';
import { Signals } from './Signals';
import { YearSelector } from './YearSelector';
import styles from '../stats.module.css';

// Adherence block (specifications/screens/stats.md §B–D): year selector + key figures +
// heatmap + monthly pivots, then the avg-calories-per-month chart and the signals. The
// year scopes everything here (rolling cards stay anchored to the latest logged day).
interface Props {
  data: AdherenceResponse | undefined;
  loading: boolean;
  year: number;
  onYear: (year: number) => void;
}

export function AdherenceSections({ data, loading, year, onYear }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.h2}>{t('stats.section.adherence')}</h2>
          <YearSelector year={year} onYear={onYear} />
        </div>
        {loading || !data ? (
          <SkeletonRows />
        ) : (
          <>
            <KeyFigures data={data.key} />
            <Heatmap cells={data.heatmap} />
            <h3 className={styles.h3}>{t('stats.section.monthly')}</h3>
            <MonthlyBars monthly={data.monthly} />
          </>
        )}
      </section>

      {data && !loading && (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>{t('stats.section.avgCalories')}</h2>
            <MonthCalorieBars monthly={data.monthly} zone={data.target_zone} />
          </section>
          <section className={styles.section}>
            <h2 className={styles.h2}>{t('stats.section.signals')}</h2>
            <Signals signals={data.signals} />
          </section>
        </>
      )}
    </>
  );
}
