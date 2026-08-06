import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateWeighInRequest,
  PatchWeighInRequest,
  WeighIn,
  WeightRange,
} from '@macronome/shared';
import { weightApi } from '../../api/weight';
import { invalidateDayScope } from '../../lib/day-scope';

// Data hooks for the Poids screen. GET /weight is the source of truth for every derived
// series (EMA, trajectory, periods, cartouche); each write invalidates the cache so the
// server-recomputed view refreshes (the web never recomputes — CLAUDE.md rule 2).
//
// A weigh-in also reaches beyond this screen (B-294): the body weight feeds the estimated burn,
// so `constat.deficit` — and with it the day tone that separates `warn` from `nok` — moves with
// it. Hence the day scope is invalidated too, for every day rather than one date: a back-dated
// weigh-in changes the interval it lands in, not only today.
export const WEIGHT_KEY = 'weight';

export function useWeight(range: WeightRange) {
  return useQuery({ queryKey: [WEIGHT_KEY, range], queryFn: () => weightApi.get(range) });
}

/** Read-only per-day recap of a period's interval [start,end] inclusive (B-225). */
export function useIntervalDays(start: string, end: string) {
  return useQuery({
    queryKey: [WEIGHT_KEY, 'interval-days', start, end],
    queryFn: () => weightApi.intervalDays(start, end),
  });
}

/** Every field a stored weigh-in carries (B-261): the create endpoint accepts exactly the five
 *  the response exposes, so an undo restores the waist measurement and the note too — not just the
 *  weight. Periods, EMA, trajectory and the cartouche are derived server-side and recompute on
 *  their own. Only the internal id differs from the deleted row. */
export function weighInRestoreBody(w: WeighIn): CreateWeighInRequest {
  return {
    date: w.date,
    weight_kg: w.weight_kg,
    waist_cm: w.waist_cm,
    diet_flag: w.diet_flag,
    note: w.note,
  };
}

export function useWeightMutations() {
  const qc = useQueryClient();
  const invalidate = (): void => {
    void qc.invalidateQueries({ queryKey: [WEIGHT_KEY] });
    invalidateDayScope(qc);
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
