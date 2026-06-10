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
import { JournalMobile } from './components/JournalMobile';
import { currentYear } from './format';
import { sortRows } from './sort';
import { useJournal } from './useJournal';
import { useJournalSort, type JournalSort } from './useJournalSort';
import { useCsvExport } from '../../lib/useCsvExport';
import { useIsMobile } from '../../lib/useIsMobile';
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
  const isMobile = useIsMobile();
  const [year, setYear] = useState(currentYear());
  const sort = useJournalSort();
  const csv = useCsvExport(dataApi.exportJournalCsv);
  const { query, patch, error, dismissError } = useJournal(year);

  const rows = query.data?.data ?? [];
  const sorted = useMemo(() => sortRows(rows, sort.sort, sort.dir), [rows, sort.sort, sort.dir]);
  const onPatch = (date: string, body: PatchDayRequest): void => patch.mutate({ date, body });

  // Shared header inputs (deduped so the mobile/desktop branches read the same values).
  const dayCount = query.data?.day_count ?? 0;
  const minYear = query.data?.min_year ?? null;
  const maxYear = query.data?.max_year ?? null;

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
      {isMobile ? (
        // Mobile (≤560px): card list + shared list chrome + day-editor sheet (S5).
        <JournalMobile
          year={year}
          minYear={minYear}
          maxYear={maxYear}
          loading={query.isLoading}
          rows={sorted}
          sort={sort}
          onYear={setYear}
          onExport={csv.start}
          onPatch={onPatch}
        />
      ) : (
        // Desktop (≥561px): the untouched header + dense table — byte-identical to before.
        <>
          <JournalHeader
            year={year}
            dayCount={dayCount}
            minYear={minYear}
            maxYear={maxYear}
            onYear={setYear}
            onExport={csv.start}
          />
          <JournalContent
            loading={query.isLoading}
            rows={rows}
            sorted={sorted}
            sort={sort}
            onPatch={onPatch}
          />
        </>
      )}
    </AppShell>
  );
}
