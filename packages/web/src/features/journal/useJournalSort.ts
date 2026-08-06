import { useState } from 'react';
import { defaultDirFor } from '../../components/DataTable/sortDir';
import type { JournalSortField } from './sort';

// Journal column sort state (B-066): client-side over the loaded year. Clicking the active column
// toggles asc/desc; switching column resets to the field's natural default — the numeric/date
// columns descending, the text ones alphabetically (B-299 generalised this rule to every table).

/** Columns that start descending on a first click (B-299). */
export const JOURNAL_DESC_FIRST: ReadonlySet<JournalSortField> = new Set<JournalSortField>([
  'date',
  'kcal',
]);

export interface JournalSort {
  sort: JournalSortField;
  dir: 'asc' | 'desc';
  onSort: (field: JournalSortField) => void;
}

export function useJournalSort(): JournalSort {
  const [sort, setSort] = useState<JournalSortField>('date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const onSort = (field: JournalSortField): void => {
    if (field === sort) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(field);
      setDir(defaultDirFor(field, JOURNAL_DESC_FIRST));
    }
  };
  return { sort, dir, onSort };
}
