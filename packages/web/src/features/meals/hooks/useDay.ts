import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateMealEntryRequest,
  CreateMealRequest,
  LeftoverRequest,
  PatchDayRequest,
  PatchLeftoverRequest,
  PatchMealRequest,
  ReorderEntriesRequest,
  UpdateMealEntryRequest,
} from '@macronome/shared';
import { daysApi } from '../../../api/days';
import { mealsApi } from '../../../api/meals';
import { entriesApi } from '../../../api/entries';
import { leftoverApi } from '../../../api/leftover';

// Data layer for the Repas screen: the day aggregate query + every mutation, each
// invalidating the day (so the server-recomputed totals/verdict/proration refetch) and
// the journal (so the calendar's day-state dots stay fresh). The web renders; it never computes.
const DAY_KEY = 'day';

/** Leftover-group mutations (split out to keep useDay within the per-function line cap). */
function useLeftoverMutations(onSuccess: () => void) {
  const createLeftover = useMutation({
    mutationFn: (v: { mealId: string; body: LeftoverRequest }) =>
      leftoverApi.create(v.mealId, v.body),
    onSuccess,
  });
  const updateLeftover = useMutation({
    mutationFn: (v: { groupId: string; body: PatchLeftoverRequest }) =>
      leftoverApi.update(v.groupId, v.body),
    onSuccess,
  });
  const removeLeftover = useMutation({ mutationFn: leftoverApi.remove, onSuccess });
  return { createLeftover, updateLeftover, removeLeftover };
}

export function useDay(date: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: [DAY_KEY, date], queryFn: () => daysApi.get(date) });

  const onSuccess = (): void => {
    void qc.invalidateQueries({ queryKey: [DAY_KEY, date] });
    void qc.invalidateQueries({ queryKey: ['journal'] });
  };

  // Materialize without invalidating: the caller (scaffold add) immediately creates an entry,
  // and that mutation's invalidation drives the single refetch — avoiding a 0-entry scaffold flash.
  const materializeRaw = () => daysApi.materialize(date);
  const patchDay = useMutation({
    mutationFn: (b: PatchDayRequest) => daysApi.patch(date, b),
    onSuccess,
  });
  const clearDay = useMutation({ mutationFn: () => daysApi.clear(date), onSuccess });
  const createMeal = useMutation({
    mutationFn: (b: CreateMealRequest) => mealsApi.create(date, b),
    onSuccess,
  });
  const patchMeal = useMutation({
    mutationFn: (v: { mealId: string; body: PatchMealRequest }) =>
      mealsApi.patch(date, v.mealId, v.body),
    onSuccess,
  });
  const removeMeal = useMutation({
    mutationFn: (mealId: string) => mealsApi.remove(date, mealId),
    onSuccess,
  });

  const createEntry = useMutation({
    mutationFn: (v: { mealId: string; body: CreateMealEntryRequest }) =>
      entriesApi.create(v.mealId, v.body),
    onSuccess,
  });
  const updateEntry = useMutation({
    mutationFn: (v: { mealId: string; id: string; body: UpdateMealEntryRequest }) =>
      entriesApi.update(v.mealId, v.id, v.body),
    onSuccess,
  });
  const reorderEntries = useMutation({
    mutationFn: (v: { mealId: string; body: ReorderEntriesRequest }) =>
      entriesApi.reorder(v.mealId, v.body),
    onSuccess,
  });
  const removeEntry = useMutation({
    mutationFn: (v: { mealId: string; id: string }) => entriesApi.remove(v.mealId, v.id),
    onSuccess,
  });
  const pinEntry = useMutation({
    mutationFn: (v: { mealId: string; id: string }) => entriesApi.pin(v.mealId, v.id),
    onSuccess,
  });
  const unpinEntry = useMutation({
    mutationFn: (v: { mealId: string; id: string }) => entriesApi.unpin(v.mealId, v.id),
    onSuccess,
  });

  const { createLeftover, updateLeftover, removeLeftover } = useLeftoverMutations(onSuccess);

  return {
    query,
    materializeRaw,
    patchDay,
    clearDay,
    createMeal,
    patchMeal,
    removeMeal,
    createEntry,
    updateEntry,
    reorderEntries,
    removeEntry,
    pinEntry,
    unpinEntry,
    createLeftover,
    updateLeftover,
    removeLeftover,
  };
}

export type UseDay = ReturnType<typeof useDay>;
