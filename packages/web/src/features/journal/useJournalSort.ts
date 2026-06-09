import { useState } from 'react';
import type { JournalSortField } from './sort';

// Journal column sort state (B-066): client-side over the loaded year. Clicking the active column
// toggles asc/desc; switching column resets to the field's natural default (Jour desc, others asc).
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
      setDir(field === 'date' ? 'desc' : 'asc');
    }
  };
  return { sort, dir, onSort };
}
