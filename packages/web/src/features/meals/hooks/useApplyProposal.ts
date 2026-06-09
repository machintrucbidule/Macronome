import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DayDetail, MealProposal } from '@macronome/shared';
import { daysApi } from '../../../api/days';
import { entriesApi } from '../../../api/entries';
import { ApiError } from '../../../api/client';
import { proposalToEntryBody } from '../logic/applyProposal';

// Apply a chosen AI proposal (B-123 / Slice 12, spec §2.5). Self-contained (no useMeals coupling,
// so the dialog stays unit-testable in isolation): materialize the day if it is still a scaffold,
// then write one referenced entry per item via the normal POST /meals/:id/entries flow. Both
// mutations invalidate the day + journal queries so the Repas page refetches the server-recomputed
// totals — the web never computes a nutrition figure here.
const DAY_KEY = 'day';

/** Map each proposal item's meal_id to a real meal id, materializing a scaffold day first.
 *  In practice the day is already materialized by apply time (the suggestions request rejects
 *  empty meal ids), so this is a safety guard; a scaffold is remapped by order_index. */
async function resolveMealIds(date: string, day: DayDetail): Promise<Map<string, string>> {
  const direct = new Map(day.meals.map((m) => [m.id, m.id] as const));
  if (day.meals.every((m) => m.id)) return direct;
  const detail = await daysApi.materialize(date);
  return new Map(
    day.meals.map((m) => {
      const real = detail.meals.find((rm) => rm.order_index === m.order_index);
      return [m.id, real?.id ?? m.id] as const;
    }),
  );
}

export function useApplyProposal(date: string) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSuccess = (): void => {
    void qc.invalidateQueries({ queryKey: [DAY_KEY, date] });
    void qc.invalidateQueries({ queryKey: ['journal'] });
  };
  const createEntry = useMutation({
    mutationFn: (v: { mealId: string; item: MealProposal['items'][number] }) =>
      entriesApi.create(v.mealId, proposalToEntryBody(v.item)),
    onSuccess,
  });

  const apply = useMutation({
    mutationFn: async (input: { proposal: MealProposal; day: DayDetail }) => {
      const byId = await resolveMealIds(date, input.day);
      for (const item of input.proposal.items) {
        await createEntry.mutateAsync({ mealId: byId.get(item.meal_id) ?? item.meal_id, item });
      }
    },
    onSuccess: () => setDone(true),
    onError: (e) => setError(e instanceof ApiError ? e.code : 'request_failed'),
  });

  return {
    apply: (proposal: MealProposal, day: DayDetail): void => {
      if (apply.isPending) return;
      setError(null);
      apply.mutate({ proposal, day });
    },
    isApplying: apply.isPending,
    error,
    done,
  };
}
