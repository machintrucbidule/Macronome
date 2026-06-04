import type { ActivityLevel, EntryUnit, MacroSnap, Verdict } from '@macronome/shared';
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
}
export interface CustomTarget {
  mealId: string;
  mealIndex: number;
  entryId: string | null;
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
  setPendingFocus: (id: string | null) => void;
  setError: (code: string | null) => void;
}

type Run = (p: Promise<unknown>) => Promise<void>;

const served = (g: number | null) =>
  g && g > 0 ? { served_quantity: g, unit: 'g' as EntryUnit } : {};

function lineActions(d: MealActionDeps, run: Run) {
  /** Resolve a real meal id, materializing the day first when the slot is still a scaffold. */
  const resolveMealId = async (mealId: string, mealIndex: number): Promise<string> => {
    if (mealId) return mealId;
    const detail = await d.day.materializeRaw();
    const real = detail.meals.find((m) => m.order_index === mealIndex)?.id;
    if (!real) throw new ApiError(500, 'meal_unresolved');
    return real;
  };

  return {
    startEdit: (mealId: string, mealIndex: number, entryId: string | null) =>
      d.setEditing({ mealId, mealIndex, entryId }),
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
              body: { kind: 'referenced', food_id: foodId, served_quantity: 0, unit: 'g' },
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

    openCustom: (mealId: string, mealIndex: number, entryId: string | null) => {
      d.setEditing(null);
      d.setCustomTarget({ mealId, mealIndex, entryId });
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
            await d.day.createEntry.mutateAsync({ mealId, body: { kind: 'custom', ...body } });
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
    setActivity: (level: string | null) =>
      run(d.day.patchDay.mutateAsync({ activity_level: level as ActivityLevel | null })),
    setComment: (comment: string) => run(d.day.patchDay.mutateAsync({ comment })),
    setVerdict: (verdict_override: Verdict | null) =>
      run(d.day.patchDay.mutateAsync({ verdict_override })),
    openLeftover: (mealId: string) => d.setLeftoverMealId(mealId),
    closeLeftover: () => d.setLeftoverMealId(null),
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
  return { ...lineActions(d, run), ...dayActions(d, run) };
}

export type MealActions = ReturnType<typeof createMealActions>;
