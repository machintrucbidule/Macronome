import type {
  ActivityLevel,
  EntryUnit,
  MacroSnap,
  MealEntry,
  UpdateMealEntryRequest,
  Verdict,
} from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { shiftIso } from '../format';
import type { UseDay } from './useDay';

// Action builder for the Repas controller: ergonomic wrappers over the useDay mutations, kept
// out of the hook (and split line/day) so each unit stays small. Scaffold handling: a slot with
// an empty id triggers materialize first, then resolves the real meal by order_index. No
// nutrition is computed here.

export interface EditTarget {
  mealId: string;
  mealIndex: number;
  /** null = adding a new line to the meal; otherwise the entry being re-picked. */
  entryId: string | null;
  /** Target row for a new line (B-028): adds at this order_index, leaving blank rows above. */
  orderIndex?: number | null;
  /** Type-to-search seed (B-105): the first character typed on the focused name cell, so the
   *  picker opens already querying it (caret at end). Absent → seed with the current name. */
  initialQuery?: string | undefined;
}
export interface CustomTarget {
  mealId: string;
  mealIndex: number;
  entryId: string | null;
  orderIndex?: number | null;
}
export interface CustomValues {
  name: string;
  kcal: number;
  servedGrams: number | null;
  snap: MacroSnap;
}

export interface MealActionDeps {
  day: UseDay;
  /** The current day's date (YYYY-MM-DD) — used to derive yesterday for copy (B-082). */
  date: string;
  setEditing: (t: EditTarget | null) => void;
  setCustomTarget: (t: CustomTarget | null) => void;
  setLeftoverMealId: (id: string | null) => void;
  setCookMealId: (id: string | null) => void;
  setPendingFocus: (id: string | null) => void;
  setError: (code: string | null) => void;
}

/** A single cook-mode adjustment: the entry id + the changed fields (qty/unit/food). */
export interface CookEdit {
  id: string;
  body: UpdateMealEntryRequest;
}

type Run = (p: Promise<unknown>) => Promise<void>;

const served = (g: number | null) =>
  g && g > 0 ? { served_quantity: g, unit: 'g' as EntryUnit } : {};

/** Resolve a real meal id, materializing the day first when the slot is still a scaffold. */
type ResolveMealId = (mealId: string, mealIndex: number) => Promise<string>;
function makeResolveMealId(d: MealActionDeps): ResolveMealId {
  return async (mealId, mealIndex) => {
    if (mealId) return mealId;
    const detail = await d.day.materializeRaw();
    const real = detail.meals.find((m) => m.order_index === mealIndex)?.id;
    if (!real) throw new ApiError(500, 'meal_unresolved');
    return real;
  };
}

/** Resolve a real (mealId, entryId) for a line edit. On a scaffold pre-fill line (empty ids)
 *  the day is materialized first, then the line is mapped to its real meal + entry by
 *  order_index / food_id before the write — the server cannot patch a phantom id (Failure 2). */
type ResolveEntry = (
  mealId: string,
  mealIndex: number,
  entry: MealEntry,
) => Promise<{ mealId: string; id: string }>;
function makeResolveEntry(d: MealActionDeps): ResolveEntry {
  return async (mealId, mealIndex, entry) => {
    if (entry.id) return { mealId, id: entry.id };
    const detail = await d.day.materializeRaw();
    const meal = detail.meals.find((m) => m.order_index === mealIndex);
    const real =
      meal?.entries.find((e) => entry.food_id !== null && e.food_id === entry.food_id) ??
      meal?.entries.find((e) => e.order_index === entry.order_index);
    if (!meal || !real) throw new ApiError(500, 'entry_unresolved');
    return { mealId: meal.id, id: real.id };
  };
}

function lineActions(
  d: MealActionDeps,
  run: Run,
  resolveMealId: ResolveMealId,
  resolveEntry: ResolveEntry,
) {
  // Edit a line, resolving a scaffold pre-fill line (empty ids) to its real meal+entry first.
  const editLine = (
    mealId: string,
    mealIndex: number,
    entry: MealEntry,
    body: UpdateMealEntryRequest,
  ): Promise<void> =>
    run(
      (async () => {
        const real = await resolveEntry(mealId, mealIndex, entry);
        await d.day.updateEntry.mutateAsync({ mealId: real.mealId, id: real.id, body });
      })(),
    );
  return {
    async pickFood(t: EditTarget, foodId: string): Promise<void> {
      d.setEditing(null);
      await run(
        (async () => {
          if (t.entryId) {
            await d.day.updateEntry.mutateAsync({
              mealId: t.mealId,
              id: t.entryId,
              body: { food_id: foodId },
            });
            d.setPendingFocus(t.entryId);
          } else {
            const mealId = await resolveMealId(t.mealId, t.mealIndex);
            const entry = await d.day.createEntry.mutateAsync({
              mealId,
              body: {
                kind: 'referenced',
                food_id: foodId,
                served_quantity: 0,
                unit: 'g',
                ...(t.orderIndex == null ? {} : { order_index: t.orderIndex }),
              },
            });
            d.setPendingFocus(entry.id);
          }
        })(),
      );
    },

    // setQty/setUnit accept the full entry + mealIndex so a scaffold pre-fill line (empty ids)
    // is materialized and remapped before the write (Failure 2); a persisted line resolves
    // immediately (no materialize).
    setQty: (
      mealId: string,
      mealIndex: number,
      entry: MealEntry,
      qty: number,
      unit: EntryUnit,
      portion_id?: string | null,
    ) => editLine(mealId, mealIndex, entry, { served_quantity: qty, unit, portion_id }),
    setUnit: (
      mealId: string,
      mealIndex: number,
      entry: MealEntry,
      unit: EntryUnit,
      portion_id: string | null,
    ) => editLine(mealId, mealIndex, entry, { unit, portion_id }),
    // A scaffold pre-fill line (empty id) has nothing persisted to delete → no-op.
    deleteEntry: (mealId: string, id: string) =>
      id ? run(d.day.removeEntry.mutateAsync({ mealId, id })) : Promise.resolve(),
    // Pin/unpin a referenced line as garde-manger (future-day prefill); persisted lines only.
    togglePin: (mealId: string, id: string, pinned: boolean) =>
      run((pinned ? d.day.unpinEntry : d.day.pinEntry).mutateAsync({ mealId, id })),
    // Drag-reorder a meal's lines (B-029): the full new position map; sparse rows kept.
    reorderEntries: (mealId: string, order: { id: string; order_index: number }[]) =>
      run(d.day.reorderEntries.mutateAsync({ mealId, body: { order } })),
  };
}

// Open/close the inline food picker. startEdit carries an optional type-to-search seed (B-105):
// the first character typed on the focused name cell, so the picker opens already querying it.
function editActions(d: MealActionDeps) {
  return {
    startEdit: (
      mealId: string,
      mealIndex: number,
      entryId: string | null,
      orderIndex?: number | null,
      initialQuery?: string,
    ) => d.setEditing({ mealId, mealIndex, entryId, orderIndex: orderIndex ?? null, initialQuery }),
    closeEdit: () => d.setEditing(null),
  };
}

function customActions(d: MealActionDeps, run: Run, resolveMealId: ResolveMealId) {
  return {
    openCustom: (
      mealId: string,
      mealIndex: number,
      entryId: string | null,
      orderIndex?: number | null,
    ) => {
      d.setEditing(null);
      d.setCustomTarget({ mealId, mealIndex, entryId, orderIndex: orderIndex ?? null });
    },
    closeCustom: () => d.setCustomTarget(null),
    saveCustom: (target: CustomTarget, v: CustomValues): Promise<void> =>
      run(
        (async () => {
          d.setCustomTarget(null);
          const body = { custom_name: v.name, snap: v.snap, ...served(v.servedGrams) };
          if (target.entryId) {
            await d.day.updateEntry.mutateAsync({
              mealId: target.mealId,
              id: target.entryId,
              body,
            });
          } else {
            const mealId = await resolveMealId(target.mealId, target.mealIndex);
            await d.day.createEntry.mutateAsync({
              mealId,
              body: {
                kind: 'custom',
                ...body,
                ...(target.orderIndex == null ? {} : { order_index: target.orderIndex }),
              },
            });
          }
        })(),
      ),
  };
}

function dayActions(d: MealActionDeps, run: Run) {
  return {
    addMeal: (slot_name: string, order_index: number) =>
      run(d.day.createMeal.mutateAsync({ slot_name, order_index })),
    renameMeal: (mealId: string, slot_name: string) =>
      run(d.day.patchMeal.mutateAsync({ mealId, body: { slot_name } })),
    deleteMeal: (mealId: string) => run(d.day.removeMeal.mutateAsync(mealId)),
    setActivity: (level: ActivityLevel) =>
      run(d.day.patchDay.mutateAsync({ activity_level: level })),
    setComment: (comment: string) => run(d.day.patchDay.mutateAsync({ comment })),
    setVerdict: (verdict_override: Verdict | null) =>
      run(d.day.patchDay.mutateAsync({ verdict_override })),
    // Edit a Partiel day's calorie total from the Repas Calories card (B-079; parity with Journal).
    setSummaryKcal: (summary_kcal: number) => run(d.day.patchDay.mutateAsync({ summary_kcal })),
    // Tout effacer (B-046): server clears foods/leftovers, keeps pins@0 + comment + activity.
    clearDay: () => run(d.day.clearDay.mutateAsync()),
    // Copier hier (B-082): server replaces today with a faithful copy of yesterday (date−1).
    copyYesterday: () => run(d.day.copyDay.mutateAsync({ from: shiftIso(d.date, -1) })),
    // Convert a summary (light) day to a detailed day so the user can log meal lines (day-model §9).
    convertToDetailed: () => run(d.day.convertToDetailed.mutateAsync()),
    // Convert a detailed (Complet) day to a summary (Partiel) day (DK-1 / B-078): discards lines,
    // freezes summary_kcal := Σ. The destructive confirm is handled by the chip menu component.
    convertToSummary: () => run(d.day.convertToSummary.mutateAsync()),
    openLeftover: (mealId: string) => d.setLeftoverMealId(mealId),
    closeLeftover: () => d.setLeftoverMealId(null),
    openCook: (mealId: string) => d.setCookMealId(mealId),
    closeCook: () => d.setCookMealId(null),
    // Cook mode edits a working copy; Valider writes the diffed entry patches back, then closes.
    applyCookEdits: (mealId: string, edits: CookEdit[]) =>
      run(
        (async () => {
          d.setCookMealId(null);
          for (const e of edits)
            await d.day.updateEntry.mutateAsync({ mealId, id: e.id, body: e.body });
        })(),
      ),
    clearFocus: () => d.setPendingFocus(null),
    dismissError: () => d.setError(null),
  };
}

export function createMealActions(d: MealActionDeps) {
  const run: Run = async (p) => {
    try {
      await p;
      d.setError(null);
    } catch (e) {
      d.setError(e instanceof ApiError ? e.code : 'request_failed');
    }
  };
  const resolveMealId = makeResolveMealId(d);
  const resolveEntry = makeResolveEntry(d);
  return {
    ...editActions(d),
    ...lineActions(d, run, resolveMealId, resolveEntry),
    ...customActions(d, run, resolveMealId),
    ...dayActions(d, run),
  };
}

export type MealActions = ReturnType<typeof createMealActions>;
