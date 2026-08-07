import { useMemo, useState } from 'react';
import type { Food, FoodSource } from '@macronome/shared';
import type { SortField } from './components/FoodTable';
import type { MinRating, VisibilityFilter } from './components/FiltersPopover';
import { sourceFilterOptions, type SourceFilter } from './sourceFilter';
import { defaultDirFor } from '../../components/DataTable/sortDir';
import { useFoodsList } from './useFoods';
import { useFoodsBulk } from './useFoodsBulk';

// Filter/sort state of the "Mes aliments" mode, and the query it produces. Extracted from
// FoodsPage so the page stays a thin mode + modal switch.
//
// The search text is NOT owned here: it is shared with the Catalogue Ciqual mode and lives on
// the page, so switching mode keeps what the user typed (B-292).

/** Columns that start descending on a first click (B-299): every numeric one. */
export const FOODS_DESC_FIRST: ReadonlySet<SortField> = new Set<SortField>([
  'kcal',
  'fat',
  'carb',
  'protein',
  'rating',
  'usage',
]);

export interface FoodsFilterState {
  minRating: MinRating;
  visibility: VisibilityFilter;
  source: SourceFilter;
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
}

/** Only non-default values are emitted, so an untouched screen sends `{sort, dir}` and nothing else. */
export function buildListParams(s: FoodsFilterState, q: string) {
  return {
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(s.minRating > 0 ? { min_rating: s.minRating as 1 | 2 | 3 } : {}),
    ...(s.visibility !== 'all' ? { visibility: s.visibility } : {}),
    ...(s.source !== 'all' ? { source: s.source } : {}),
    ...(s.showArchived ? { include_archived: true } : {}),
    sort: s.sort,
    dir: s.dir,
  };
}

function useFoodsFilters() {
  const [minRating, setMinRating] = useState<MinRating>(0);
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<SortField>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  // Same field → flip the direction; a new field starts in its useful direction (B-299).
  const onSort = (field: SortField): void => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir(defaultDirFor(field, FOODS_DESC_FIRST));
    }
  };

  const state: FoodsFilterState = { minRating, visibility, source, showArchived, sort, dir };
  return {
    state,
    handlers: {
      onMinRating: setMinRating,
      onVisibility: setVisibility,
      onSource: setSource,
      onShowArchived: setShowArchived,
      onSort,
    },
  };
}

/**
 * Everything the "Mes aliments" mode needs: its filters and the page of foods they select.
 * Returned as one bundle so the page can both hand it to the view and read `foods`/`sources`
 * for the food form — without a callback fired during render.
 */
export function useFoodsLibrary(q: string) {
  const filters = useFoodsFilters();
  const params = buildListParams(filters.state, q);
  const list = useFoodsList(params);
  // Batch selection (BE-1) rides along in the same bundle, so both views receive it by the spread
  // the page already does — and it is built from the SAME params, which is what keeps "select
  // everything matching the filter" honest.
  const bulk = useFoodsBulk(params);
  // Every page of one query reports the same `total` (B-278) and the same `sources` (B-295), so
  // the hook keeps whichever answered — since B-303 that is not necessarily page 1, because a
  // scrollbar jump asks for the page under the thumb first. Undefined until one lands, so the
  // toolbar shows nothing rather than a number that would immediately change.
  const sources: FoodSource[] = list.sources;
  return {
    ...filters.state,
    ...filters.handlers,
    foods: list.rows,
    sources,
    sourceOptions: useSourceFilterOptions(sources),
    total: list.total,
    loading: list.loading,
    isError: list.isError,
    list,
    bulk,
  };
}

export type FoodsLibrary = ReturnType<typeof useFoodsLibrary>;
export type LibraryFood = Food;

/** Which Source chips to offer, from the provenances the server reports as present (B-295). */
export function useSourceFilterOptions(sources: FoodSource[] | undefined): SourceFilter[] {
  return useMemo(() => sourceFilterOptions(sources ?? []), [sources]);
}
