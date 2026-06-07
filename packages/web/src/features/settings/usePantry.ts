import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePantryRequest, UpdatePantryRequest } from '@macronome/shared';
import { pantryApi } from '../../api/pantry';

// Garde-manger data hooks (spec/api §Settings). The full pantry is fetched once and grouped
// by meal slot in the editor. The pin is the single source of truth and is reflected live
// on every day (B-045), so editing it here also refreshes the open day + journal views.
const PANTRY_KEY = ['pantry'] as const;

export function usePantry() {
  return useQuery({ queryKey: PANTRY_KEY, queryFn: () => pantryApi.list() });
}

export function usePantryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: PANTRY_KEY });
    void qc.invalidateQueries({ queryKey: ['day'] });
    void qc.invalidateQueries({ queryKey: ['journal'] });
  };
  return {
    create: useMutation({
      mutationFn: (body: CreatePantryRequest) => pantryApi.create(body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (vars: { id: string; body: UpdatePantryRequest }) =>
        pantryApi.update(vars.id, vars.body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => pantryApi.remove(id),
      onSuccess: invalidate,
    }),
  };
}
