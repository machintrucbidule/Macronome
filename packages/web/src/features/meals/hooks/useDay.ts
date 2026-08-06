import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateMealEntryRequest,
  CreateMealRequest,
  LeftoverRequest,
  PatchDayRequest,
  PatchLeftoverRequest,
  MoveEntryRequest,
  PatchMealRequest,
  ReorderEntriesRequest,
  UpdateMealEntryRequest,
} from '@macronome/shared';
import { daysApi } from '../../../api/days';
import { mealsApi } from '../../../api/meals';
import { entriesApi } from '../../../api/entries';
import { leftoverApi } from '../../../api/leftover';
import { tap } from '../../../lib/haptics';
import { DAY_KEY, invalidateDayScope } from '../../../lib/day-scope';

// Data layer for the Repas screen: the day aggregate query + every mutation, each
// invalidating the day (so the server-recomputed totals/verdict/proration refetch), the
// journal (so the calendar's day-state dots stay fresh) and the app-frame tone — all three
// through `invalidateDayScope` (B-294). The web renders; it never computes.

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

/** Entry-level mutations. Split out to keep useDay within the per-function line cap; each
 *  invalidates the day + journal via onSuccess, and a confirmed add fires a light haptic
 *  (PWA-1/B-144, no-op on desktop/iOS). */
function useEntryMutations(onSuccess: () => void) {
  const createEntry = useMutation({
    mutationFn: (v: { mealId: string; body: CreateMealEntryRequest }) =>
      entriesApi.create(v.mealId, v.body),
    onSuccess: () => {
      tap();
      onSuccess();
    },
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
  const moveEntry = useMutation({
    mutationFn: (v: { mealId: string; id: string; body: MoveEntryRequest }) =>
      entriesApi.move(v.mealId, v.id, v.body),
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
  return { createEntry, updateEntry, reorderEntries, moveEntry, removeEntry, pinEntry, unpinEntry };
}

/** Day-level whole-day mutations (clear + kind conversions). Split out to keep useDay within
 *  the per-function line cap; each invalidates the day + journal via onSuccess. */
function useDayKindMutations(date: string, onSuccess: () => void) {
  const clearDay = useMutation({ mutationFn: () => daysApi.clear(date), onSuccess });
  // Copy another day (yesterday) into this one (CP-1 / B-082): replaces the current day.
  const copyDay = useMutation({
    mutationFn: (v: { from: string }) => daysApi.copyFrom(date, v.from),
    onSuccess,
  });
  const convertToDetailed = useMutation({
    mutationFn: () => daysApi.convertToDetailed(date),
    onSuccess,
  });
  const convertToSummary = useMutation({
    mutationFn: () => daysApi.convertToSummary(date),
    onSuccess,
  });
  // Undo the last destructive day action (B-261): the server replays its restore point, so the
  // day comes back with its leftovers and frozen containers intact. Single-level — 409 after one.
  const undoDay = useMutation({ mutationFn: () => daysApi.undo(date), onSuccess });
  return { clearDay, copyDay, convertToDetailed, convertToSummary, undoDay };
}

export function useDay(date: string) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: [DAY_KEY, date], queryFn: () => daysApi.get(date) });

  const onSuccess = (): void => invalidateDayScope(qc, date);

  // Materialize without invalidating: the caller (scaffold add) immediately creates an entry,
  // and that mutation's invalidation drives the single refetch — avoiding a 0-entry scaffold flash.
  const materializeRaw = () => daysApi.materialize(date);
  const patchDay = useMutation({
    mutationFn: (b: PatchDayRequest) => daysApi.patch(date, b),
    onSuccess,
  });
  const { clearDay, copyDay, convertToDetailed, convertToSummary, undoDay } = useDayKindMutations(
    date,
    onSuccess,
  );
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
  // Replace one meal with the matching meal of another day (CP-2 / B-248).
  const copyMeal = useMutation({
    mutationFn: (v: { mealId: string; from: string }) => mealsApi.copyFrom(v.mealId, v.from),
    onSuccess,
  });

  const { createEntry, updateEntry, reorderEntries, moveEntry, removeEntry, pinEntry, unpinEntry } =
    useEntryMutations(onSuccess);

  const { createLeftover, updateLeftover, removeLeftover } = useLeftoverMutations(onSuccess);

  return {
    query,
    materializeRaw,
    patchDay,
    clearDay,
    copyDay,
    convertToDetailed,
    convertToSummary,
    undoDay,
    createMeal,
    patchMeal,
    removeMeal,
    copyMeal,
    createEntry,
    updateEntry,
    reorderEntries,
    moveEntry,
    removeEntry,
    pinEntry,
    unpinEntry,
    createLeftover,
    updateLeftover,
    removeLeftover,
  };
}

export type UseDay = ReturnType<typeof useDay>;
