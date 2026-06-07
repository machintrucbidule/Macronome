import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { Banner } from '../../components/Banner/Banner';
import { EmptyState } from '../../components/states/EmptyState';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { JournalHeader } from './components/JournalHeader';
import { JournalTable } from './components/JournalTable';
import { currentYear } from './format';
import { sortRows, type JournalSortField } from './sort';
import { useJournal } from './useJournal';
import styles from './journal.module.css';

// Journal page (specifications/screens/history.md): the chronological, editable day history.
// Owns the selected-year + sort state, fetches the per-year list via TanStack Query, and
// renders the dense table + inline edits. It renders server-computed values; it never
// computes — sorting is presentation-only over the already-loaded year (B-067).
export function JournalPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(currentYear());
  const [sort, setSort] = useState<JournalSortField>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const { query, patch, error, dismissError } = useJournal(year);

  const rows = query.data?.data ?? [];
  const dayCount = query.data?.day_count ?? 0;
  const minYear = query.data?.min_year ?? null;
  const maxYear = query.data?.max_year ?? null;

  const sorted = useMemo(() => sortRows(rows, sort, dir), [rows, sort, dir]);

  const onSort = (field: JournalSortField): void => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir(field === 'date' ? 'desc' : 'asc');
    }
  };

  return (
    <AppShell>
      {error && (
        <div className={styles.errorBar}>
          <Banner tone="warning" onDismiss={dismissError}>
            {t('journal.error', { code: error })}
          </Banner>
        </div>
      )}
      <JournalHeader
        year={year}
        dayCount={dayCount}
        minYear={minYear}
        maxYear={maxYear}
        onYear={setYear}
      />
      {query.isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState>{t('journal.empty')}</EmptyState>
      ) : (
        <JournalTable
          rows={sorted}
          sort={sort}
          dir={dir}
          onSort={onSort}
          onPatch={(date, body) => patch.mutate({ date, body })}
        />
      )}
    </AppShell>
  );
}
