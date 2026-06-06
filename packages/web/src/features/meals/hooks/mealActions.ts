import type {
  ActivityLevel,
  EntryUnit,
  MacroSnap,
  UpdateMealEntryRequest,
  Verdict,
} from '@macronome/shared';
import { ApiError } from '../../../api/client';
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

function lineActions(d: MealActionDeps, run: Run, resolveMealId: ResolveMealId) {
  return {
    startEdit: (
      mealId: string,
      mealIndex: number,
      entryId: string | null,
      orderIndex?: number | null,
    ) => d.setEditing({ mealId, mealIndex, entryId, orderIndex: orderIndex ?? null }),
    closeEdit: () => d.setEditing(null),

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

    setQty: (
      mealId: string,
      id: string,
      qty: number,
      unit: EntryUnit,
      portion_id?: string | null,
    ) =>
      run(
        d.day.updateEntry.mutateAsync({
          mealId,
          id,
          body: { served_quantity: qty, unit, portion_id },
        }),
      ),
    setUnit: (mealId: string, id: string, unit: EntryUnit, portion_id: string | null) =>
      run(d.day.updateEntry.mutateAsync({ mealId, id, body: { unit, portion_id } })),
    deleteEntry: (mealId: string, id: string) => run(d.day.removeEntry.mutateAsync({ mealId, id })),
    // Pin/unpin a referenced line as garde-manger (future-day prefill); persisted lines only.
    togglePin: (mealId: string, id: string, pinned: boolean) =>
      run((pinned ? d.day.unpinEntry : d.day.pinEntry).mutateAsync({ mealId, id })),
    // Drag-reorder a meal's lines (B-029): the full new position map; sparse rows kept.
    reorderEntries: (mealId: string, order: { id: string; order_index: number }[]) =>
      run(d.day.reorderEntries.mutateAsync({ mealId, body: { order } })),
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
    // Tout effacer (B-046): server clears foods/leftovers, keeps pins@0 + comment + activity.
    clearDay: () => run(d.day.clearDay.mutateAsync()),
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
  return {
    ...lineActions(d, run, resolveMealId),
    ...customActions(d, run, resolveMealId),
    ...dayActions(d, run),
  };
}

export type MealActions = ReturnType<typeof createMealActions>;
