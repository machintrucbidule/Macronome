export type SortDir = 'asc' | 'desc';

// B-299: clicking a new column used to always start ascending, which on a numeric column lists the
// least interesting rows first — the lowest calories, the worst rating, the least-used food, the
// oldest account. Every table now starts a column in its useful direction: a column carrying a
// number or a date sorts descending first, a text column alphabetically. Re-clicking still toggles,
// and the default sort on page load is unchanged. Same rule everywhere — the per-screen sets below
// each caller's sort state say which of its fields are numeric/date.
//
// The pattern predates this helper: `features/journal/useJournalSort.ts` already picked "the
// field's natural default" for Jour; this generalises it instead of adding a second mechanism.

/** Direction a column starts in when it becomes the sort field. */
export function defaultDirFor<K extends string>(field: K, descFirst: ReadonlySet<K>): SortDir {
  return descFirst.has(field) ? 'desc' : 'asc';
}

/** Direction after a header click: same column → flip, new column → its natural default. */
export function nextSortDir<K extends string>(
  field: K,
  current: K,
  dir: SortDir,
  descFirst: ReadonlySet<K>,
): SortDir {
  if (field === current) return dir === 'asc' ? 'desc' : 'asc';
  return defaultDirFor(field, descFirst);
}
