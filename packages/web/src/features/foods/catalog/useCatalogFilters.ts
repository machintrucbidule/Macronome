import { useState } from 'react';
import type { FoodRefListParams } from '../../../api/foodRefs';
import { defaultDirFor } from '../../../components/DataTable/sortDir';

// Filter/sort state of the Catalogue Ciqual mode (B-292). Mirrors useFoodsFilters, minus the
// dimensions a read-only reference table has no business with (rating, visibility, archived).
// The search text is NOT here: it is shared with the library mode and lives on the page, so
// switching mode keeps what you typed.

export type CatalogSortField = 'name' | 'kcal' | 'fat' | 'carb' | 'protein';

/** Columns that start descending on a first click (B-299): every numeric one. */
export const CATALOG_DESC_FIRST: ReadonlySet<CatalogSortField> = new Set<CatalogSortField>([
  'kcal',
  'fat',
  'carb',
  'protein',
]);

/** `''` = every group (the "Tous les groupes" option). */
export type GroupFilter = string;

export interface CatalogFilterState {
  group: GroupFilter;
  sort: CatalogSortField;
  dir: 'asc' | 'desc';
}

export function buildRefListParams(
  s: CatalogFilterState,
  q: string,
  locale: 'fr' | 'en',
): FoodRefListParams {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(s.group ? { group: s.group } : {}),
    locale,
    sort: s.sort,
    dir: s.dir,
  };
}

export function useCatalogFilters() {
  const [group, setGroup] = useState<GroupFilter>('');
  const [sort, setSort] = useState<CatalogSortField>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  // Same field → flip the direction; a new field starts in its useful direction (as in the
  // library, B-299).
  const onSort = (field: CatalogSortField): void => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir(defaultDirFor(field, CATALOG_DESC_FIRST));
    }
  };

  const state: CatalogFilterState = { group, sort, dir };
  return { state, handlers: { onGroup: setGroup, onSort } };
}
