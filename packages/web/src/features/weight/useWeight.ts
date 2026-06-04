import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateWeighInRequest, PatchWeighInRequest, WeightRange } from '@macronome/shared';
import { weightApi } from '../../api/weight';

// Data hooks for the Poids screen. GET /weight is the source of truth for every derived
// series (EMA, trajectory, periods, cartouche); each write invalidates the cache so the
// server-recomputed view refreshes (the web never recomputes — CLAUDE.md rule 2).
const KEY = 'weight';

export function useWeight(range: WeightRange) {
  return useQuery({ queryKey: [KEY, range], queryFn: () => weightApi.get(range) });
}

export function useWeightMutations() {
  const qc = useQueryClient();
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: [KEY] });
  };
  const create = useMutation({
    mutationFn: (body: CreateWeighInRequest) => weightApi.create(body),
    onSuccess: invalidate,
  });
  const patch = useMutation({
    mutationFn: (v: { id: string; body: PatchWeighInRequest }) => weightApi.patch(v.id, v.body),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => weightApi.del(id),
    onSuccess: invalidate,
  });
  return { create, patch, remove };
}
