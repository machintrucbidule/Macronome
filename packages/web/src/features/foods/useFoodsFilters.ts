import { useMemo, useState } from 'react';
import type { FoodSource } from '@macronome/shared';
import type { SortField } from './components/FoodTable';
import type { MinRating, VisibilityFilter } from './components/FiltersPopover';
import { sourceFilterOptions, type SourceFilter } from './sourceFilter';

// Filter/sort state of the Aliments screen, and the query params it produces. Extracted from
// FoodsPage so the page stays a thin data-fetch + layout switch: the state grew a fourth
// dimension with the Source filter (B-291) and the whole block reads better on its own.

export interface FoodsFilterState {
  q: string;
  minRating: MinRating;
  visibility: VisibilityFilter;
  source: SourceFilter;
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
}

/** Only non-default values are emitted, so an untouched screen sends `{sort, dir}` and nothing else. */
export function buildListParams(s: FoodsFilterState) {
  return {
    ...(s.q.trim() ? { q: s.q.trim() } : {}),
    ...(s.minRating > 0 ? { min_rating: s.minRating as 1 | 2 | 3 } : {}),
    ...(s.visibility !== 'all' ? { visibility: s.visibility } : {}),
    ...(s.source !== 'all' ? { source: s.source } : {}),
    ...(s.showArchived ? { include_archived: true } : {}),
    sort: s.sort,
    dir: s.dir,
  };
}

export function useFoodsFilters() {
  const [q, setQ] = useState('');
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

  const state: FoodsFilterState = { q, minRating, visibility, source, showArchived, sort, dir };
  return {
    state,
    params: buildListParams(state),
    handlers: {
      onQ: setQ,
      onMinRating: setMinRating,
      onVisibility: setVisibility,
      onSource: setSource,
      onShowArchived: setShowArchived,
      onSort,
    },
  };
}

/** Which Source chips to offer, from the provenances the server reports as present (B-295). */
export function useSourceFilterOptions(sources: FoodSource[] | undefined): SourceFilter[] {
  return useMemo(() => sourceFilterOptions(sources ?? []), [sources]);
}
