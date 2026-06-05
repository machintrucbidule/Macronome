import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { EmptyState } from '../../components/states/EmptyState';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { AdherenceSections } from './components/AdherenceSections';
import { RollingCards } from './components/RollingCards';
import { currentYear, formatDate } from './format';
import { useAdherence, useRolling } from './useStats';
import styles from './stats.module.css';

// Stats screen (specifications/screens/stats.md): rolling cards (as of the latest logged
// day) + the year-scoped adherence block (key figures, heatmap, monthly pivots, signals).
// Every figure is server-derived; this screen owns only the selected-year state and renders.
export function StatsPage() {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(currentYear());
  const rolling = useRolling();
  const adherence = useAdherence(year);

  const asOf = rolling.data?.as_of ?? null;
  const noData = rolling.data !== undefined && asOf === null;

  return (
    <AppShell>
      <header className={styles.head}>
        <h1 className={styles.title}>{t('stats.title')}</h1>
        {asOf && (
          <span className={styles.asOf}>
            {t('stats.asOf', { date: formatDate(asOf, i18n.language) })}
          </span>
        )}
      </header>

      {rolling.isLoading ? (
        <SkeletonRows />
      ) : noData ? (
        <EmptyState>{t('stats.empty')}</EmptyState>
      ) : (
        <>
          <RollingCards windows={rolling.data!.windows} />
          <AdherenceSections
            data={adherence.data}
            loading={adherence.isLoading}
            year={year}
            onYear={setYear}
          />
        </>
      )}
    </AppShell>
  );
}
