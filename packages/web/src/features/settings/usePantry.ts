import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePantryRequest } from '@macronome/shared';
import { pantryApi } from '../../api/pantry';

// Garde-manger data hooks (spec/api §Settings). The full pantry is fetched once and grouped
// by meal slot in the editor; mutations affect future-day prefill only.
const PANTRY_KEY = ['pantry'] as const;

export function usePantry() {
  return useQuery({ queryKey: PANTRY_KEY, queryFn: () => pantryApi.list() });
}

export function usePantryMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PANTRY_KEY });
  return {
    create: useMutation({
      mutationFn: (body: CreatePantryRequest) => pantryApi.create(body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => pantryApi.remove(id),
      onSuccess: invalidate,
    }),
  };
}
