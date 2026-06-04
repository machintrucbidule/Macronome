import { Fragment, type ReactNode } from 'react';

// Diacritic-insensitive match highlight for the autocomplete (display-only — no nutrition
// computation here). Mirrors the contract's `<em>` accent treatment (forms-inputs.md §Autocomplete).
function normChar(ch: string): string {
  return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').toLowerCase();
}

/** Normalized haystack + a map from each normalized-char position back to its original index. */
function buildMap(name: string): { norm: string; origAt: number[] } {
  let norm = '';
  const origAt: number[] = [];
  for (let i = 0; i < name.length; i++) {
    for (const c of normChar(name[i] as string)) {
      norm += c;
      origAt.push(i);
    }
  }
  return { norm, origAt };
}

/** Split `name` so the (accent-insensitive) match of `query` is wrapped in <em>. */
export function highlightMatch(
  name: string,
  query: string,
  emClass: string | undefined,
): ReactNode {
  const q = query.trim().split('').map(normChar).join('');
  if (!q) return name;
  const { norm, origAt } = buildMap(name);
  const at = norm.indexOf(q);
  if (at < 0) return name;
  const start = origAt[at] as number;
  const end = at + q.length < origAt.length ? (origAt[at + q.length] as number) : name.length;
  return (
    <Fragment>
      {name.slice(0, start)}
      <em className={emClass}>{name.slice(start, end)}</em>
      {name.slice(end)}
    </Fragment>
  );
}
