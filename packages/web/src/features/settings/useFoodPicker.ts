import { useQuery } from '@tanstack/react-query';
import type { Food } from '@macronome/shared';
import { foodsApi } from '../../api/foods';

// Food lookups for the garde-manger editor: a full index (id → name, to label pinned
// chips) and a search query (to pick a food to pin). Both read the foods catalog only.

export function useFoodIndex() {
  const query = useQuery({ queryKey: ['foods', 'index'], queryFn: () => foodsApi.list({}) });
  const map = new Map<string, string>((query.data?.data ?? []).map((f: Food) => [f.id, f.name]));
  return (id: string): string => map.get(id) ?? '—';
}

export function useFoodSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['foods', 'picker', q],
    queryFn: () => foodsApi.list(q.trim() ? { q: q.trim() } : {}),
    enabled,
  });
}
