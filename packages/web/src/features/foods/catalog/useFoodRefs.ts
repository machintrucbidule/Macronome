import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { foodRefsApi, type FoodRefListParams } from '../../../api/foodRefs';
import { LIST_GC_TIME } from '../../../lib/listCache';

// Data hooks for the Catalogue Ciqual mode (B-292). Same keyset-lazy-loading shape as
// useFoodsList: the view owns the filter state and passes it in.
export const FOOD_REFS_KEY = ['food-refs'] as const;

export function useFoodRefsList(params: FoodRefListParams) {
  return useInfiniteQuery({
    queryKey: [...FOOD_REFS_KEY, params],
    queryFn: ({ pageParam }) =>
      foodRefsApi.list(pageParam ? { ...params, cursor: pageParam } : params),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    // Same reason as the foods list (B-268): keep the scrolled pages across a round trip
    // into the food form, so the restored scroll offset still has rows under it.
    gcTime: LIST_GC_TIME,
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
