import { useQuery } from '@tanstack/react-query';
import type { Food } from '@macronome/shared';
import { foodsApi } from '../../../api/foods';
import { loggableSearchApi } from '../../../api/loggableSearch';

// Food lookup for the daily-log pickers. Search backs the InlineFoodSearch autocomplete and
// queries the combined food∪recipe `/search/loggable` (so recipes are loggable in a meal);
// the single-food fetch gives the UnitMenu a referenced entry's named portions (a recipe's
// derived food is a food row, so /foods/:id resolves it too).

export function useFoodSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['loggable', 'search', query],
    queryFn: () => loggableSearchApi.search(query.trim() || undefined),
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
