import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { EmptyState } from '../../components/states/EmptyState';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { JournalHeader } from './components/JournalHeader';
import { JournalTable } from './components/JournalTable';
import { currentYear } from './format';
import { useJournal } from './useJournal';

// Journal page (specifications/screens/history.md): the chronological, editable day history.
// Owns the selected-year state, fetches the per-year list via TanStack Query, and renders
// the dense table + inline edits. It renders server-computed values; it never computes.
export function JournalPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(currentYear());
  const { query, patch } = useJournal(year);

  const rows = query.data?.data ?? [];
  const dayCount = query.data?.day_count ?? 0;

  return (
    <AppShell>
      <JournalHeader year={year} dayCount={dayCount} onYear={setYear} />
      {query.isLoading ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <EmptyState>{t('journal.empty')}</EmptyState>
      ) : (
        <JournalTable rows={rows} onPatch={(date, body) => patch.mutate({ date, body })} />
      )}
    </AppShell>
  );
}
