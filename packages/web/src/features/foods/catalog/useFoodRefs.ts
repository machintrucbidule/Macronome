import { useQuery } from '@tanstack/react-query';
import type { FoodRef } from '@macronome/shared';
import { foodRefsApi, type FoodRefListParams } from '../../../api/foodRefs';
import { usePagedList, type PagedList } from '../../../lib/usePagedList';

// Data hooks for the Catalogue Ciqual mode (B-292). The view owns the filter state and passes it
// in. Paged by row offset since LD-1/B-303 — this is the 3 400-row list the change was for.
export const FOOD_REFS_KEY = ['food-refs'] as const;

export function useFoodRefsList(params: FoodRefListParams): PagedList<FoodRef> {
  return usePagedList<FoodRef>({
    queryKey: [...FOOD_REFS_KEY, params],
    fetchPage: async (offset, limit) => {
      const res = await foodRefsApi.list({ ...params, offset, limit });
      return { data: res.data, total: res.total };
    },
  });
}

/** The group filter's options. Global reference data — cached for the session. */
export function useFoodRefGroups(locale: 'fr' | 'en') {
  return useQuery({
    queryKey: [...FOOD_REFS_KEY, 'groups', locale],
    queryFn: () => foodRefsApi.groups(locale),
    staleTime: Infinity,
  });
}
