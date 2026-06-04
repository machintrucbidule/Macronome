import { useQuery } from '@tanstack/react-query';
import type { Food } from '@macronome/shared';
import { foodsApi } from '../../../api/foods';

// Food lookup for the daily-log pickers. Search backs the InlineFoodSearch autocomplete;
// the single-food fetch gives the UnitMenu a referenced entry's named portions. The combined
// food∪recipe `/search/loggable` endpoint arrives in M5; until then we search the foods catalog.

export function useFoodSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['foods', 'search', query],
    queryFn: () => foodsApi.list({ ...(query.trim() ? { q: query.trim() } : {}) }),
    enabled,
    staleTime: 30_000,
  });
}

export function useFood(foodId: string | null) {
  return useQuery({
    queryKey: ['food', foodId],
    queryFn: () => foodsApi.get(foodId as string),
    enabled: foodId !== null,
    staleTime: 60_000,
  });
}

export type { Food };
