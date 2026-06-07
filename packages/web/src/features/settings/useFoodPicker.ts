import { useQuery } from '@tanstack/react-query';
import { foodsApi } from '../../api/foods';

// Food search for the garde-manger editor (to pick a food to pin). Pinned-chip names are
// resolved per id via useFood in PantryFoodChip (the Repas pattern), so there is no capped
// foods "index" here — every pinned food is named regardless of catalog size (B-102).

export function useFoodSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['foods', 'picker', q],
    queryFn: () => foodsApi.list(q.trim() ? { q: q.trim() } : {}),
    enabled,
  });
}
