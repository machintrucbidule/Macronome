import { ACTIVITY_LEVELS, type JournalRow, type Verdict } from '@macronome/shared';

// Client-side sorting for the Journal table (B-067 / history.md). The whole selected
// year is already loaded (≤366 rows), so sorting happens in the browser — no API round
// trip. This is presentation only; it never recomputes a nutrition figure (CLAUDE.md
// rule 2). Sort is stable: equal-key rows keep the server's newest-first order.
export type JournalSortField = 'date' | 'kcal' | 'verdict' | 'activity';

const VERDICT_RANK: Record<Verdict, number> = { OK: 0, NOK: 1 };

const ACTIVITY_ORDER = ACTIVITY_LEVELS as readonly string[];

/** Compare two rows on a non-null-handling field; lower sorts first (ascending). */
function baseCompare(a: JournalRow, b: JournalRow, field: 'date' | 'kcal' | 'activity'): number {
  switch (field) {
    case 'date':
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    case 'kcal':
      return a.kcal - b.kcal;
    case 'activity':
      return ACTIVITY_ORDER.indexOf(a.activity_level) - ACTIVITY_ORDER.indexOf(b.activity_level);
  }
}

/** A new array sorted by `field`/`dir`. Verdict nulls always sort last (both directions). */
export function sortRows(
  rows: JournalRow[],
  field: JournalSortField,
  dir: 'asc' | 'desc',
): JournalRow[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (field === 'verdict') {
      const ra = a.effective_verdict;
      const rb = b.effective_verdict;
      if (ra === null && rb === null) return 0;
      if (ra === null) return 1; // nulls last, regardless of direction
      if (rb === null) return -1;
      return (VERDICT_RANK[ra] - VERDICT_RANK[rb]) * factor;
    }
    return baseCompare(a, b, field) * factor;
  });
}
