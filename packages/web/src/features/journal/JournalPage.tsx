import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { JournalRow, PatchDayRequest } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { dataApi } from '../../api/data';
import { Banner } from '../../components/Banner/Banner';
import { EmptyState } from '../../components/states/EmptyState';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { JournalHeader } from './components/JournalHeader';
import { JournalTable } from './components/JournalTable';
import { currentYear } from './format';
import { sortRows } from './sort';
import { useJournal } from './useJournal';
import { useJournalSort, type JournalSort } from './useJournalSort';
import { useCsvExport } from '../../lib/useCsvExport';
import styles from './journal.module.css';

// Loading → empty → table switch, split out so JournalPage stays under the complexity limit.
function JournalContent(props: {
  loading: boolean;
  rows: JournalRow[];
  sorted: JournalRow[];
  sort: JournalSort;
  onPatch: (date: string, body: PatchDayRequest) => void;
}) {
  const { t } = useTranslation();
  if (props.loading) return <SkeletonRows />;
  if (props.rows.length === 0) return <EmptyState>{t('journal.empty')}</EmptyState>;
  return (
    <JournalTable
      rows={props.sorted}
      sort={props.sort.sort}
      dir={props.sort.dir}
      onSort={props.sort.onSort}
      onPatch={props.onPatch}
    />
  );
}

// Journal page (specifications/screens/history.md): the chronological, editable day history.
// Owns the selected-year + sort state, fetches the per-year list via TanStack Query, and
// renders the dense table + inline edits. It renders server-computed values; it never
// computes — sorting is presentation-only over the already-loaded year (B-067).
export function JournalPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(currentYear());
  const sort = useJournalSort();
  const csv = useCsvExport(dataApi.exportJournalCsv);
  const { query, patch, error, dismissError } = useJournal(year);

  const rows = query.data?.data ?? [];
  const sorted = useMemo(() => sortRows(rows, sort.sort, sort.dir), [rows, sort.sort, sort.dir]);

  return (
    <AppShell>
      {error && (
        <div className={styles.errorBar}>
          <Banner tone="warning" onDismiss={dismissError}>
            {t('journal.error', { code: error })}
          </Banner>
        </div>
      )}
      {csv.error && (
        <div className={styles.errorBar}>
          <Banner tone="warning" onDismiss={csv.dismiss}>
            {t('journal.exportError')}
          </Banner>
        </div>
      )}
      <JournalHeader
        year={year}
        dayCount={query.data?.day_count ?? 0}
        minYear={query.data?.min_year ?? null}
        maxYear={query.data?.max_year ?? null}
        onYear={setYear}
        onExport={csv.start}
      />
      <JournalContent
        loading={query.isLoading}
        rows={rows}
        sorted={sorted}
        sort={sort}
        onPatch={(date, body) => patch.mutate({ date, body })}
      />
    </AppShell>
  );
}
