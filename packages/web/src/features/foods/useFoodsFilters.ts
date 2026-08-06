import { useMemo, useState } from 'react';
import type { Food, FoodSource } from '@macronome/shared';
import type { SortField } from './components/FoodTable';
import type { MinRating, VisibilityFilter } from './components/FiltersPopover';
import { sourceFilterOptions, type SourceFilter } from './sourceFilter';
import { useFoodsList } from './useFoods';

// Filter/sort state of the "Mes aliments" mode, and the query it produces. Extracted from
// FoodsPage so the page stays a thin mode + modal switch.
//
// The search text is NOT owned here: it is shared with the Catalogue Ciqual mode and lives on
// the page, so switching mode keeps what the user typed (B-292).

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

  // Same field → flip the direction; a new field always starts ascending.
  const onSort = (field: SortField): void => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir('asc');
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
  const list = useFoodsList(buildListParams(filters.state, q));
  const foods = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  // Read from the newest page: every page of one query reports the same `total` (B-278) and the
  // same `sources` (B-295), and the newest is the freshest. Undefined until page 1 lands, so the
  // toolbar shows nothing rather than a number that would immediately change.
  const latest = list.data?.pages.at(-1);
  const sources: FoodSource[] = latest?.sources ?? [];
  return {
    ...filters.state,
    ...filters.handlers,
    foods,
    sources,
    sourceOptions: useSourceFilterOptions(latest?.sources),
    total: latest?.total,
    loading: list.isLoading,
    isError: list.isError,
    list,
  };
}

export type FoodsLibrary = ReturnType<typeof useFoodsLibrary>;
export type LibraryFood = Food;

/** Which Source chips to offer, from the provenances the server reports as present (B-295). */
export function useSourceFilterOptions(sources: FoodSource[] | undefined): SourceFilter[] {
  return useMemo(() => sourceFilterOptions(sources ?? []), [sources]);
}
