import type {
  ActivityLevel,
  EntryUnit,
  MacroSnap,
  MealEntry,
  PantryItem,
  UpdateMealEntryRequest,
  Verdict,
} from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { shiftIso } from '../format';
import type { Op } from '../history/op';
import { findEntry, recordAdd, recordUpdate } from '../history/recordHelpers';
import { editLineActions, pickActions } from './lineActions';
import type { UseDay } from './useDay';

// The default-unit-on-add helper lives with the line actions; re-exported for its co-located test.
export { resolveEntryDefaultUnit } from './lineActions';

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
/** Mobile-only: the line whose bottom-sheet editor is open (food · qty · pin · delete, spec §5.3).
 *  Stored on the controller like the other overlays; the sheet resolves the entry from the day. */
export interface LineSheetTarget {
  mealId: string;
  mealIndex: number;
  entryId: string;
}
export interface CustomValues {
  name: string;
  kcal: number;
  servedGrams: number | null;
  snap: MacroSnap;
}

export interface MealActionDeps {
  day: UseDay;
  /** Garde-manger pins, for the default-unit-on-add precedence (B-109). */
  pantry: PantryItem[];
  /** The current day's date (YYYY-MM-DD) — used to derive yesterday for copy (B-082). */
  date: string;
  setEditing: (t: EditTarget | null) => void;
  setCustomTarget: (t: CustomTarget | null) => void;
  setLineSheetTarget: (t: LineSheetTarget | null) => void;
  setLeftoverMealId: (id: string | null) => void;
  setCookMealId: (id: string | null) => void;
  setPendingFocus: (id: string | null) => void;
  setError: (code: string | null) => void;
  /** Record a line edit on the undo/redo stack (UR-1 / B-133). Line ops only; day-level ops
   *  never call it. Absent in contexts without history (e.g. tests). */
  recordHistory?: (op: Op) => void;
}

/** A single cook-mode adjustment: the entry id + the changed fields (qty/unit/food). */
export interface CookEdit {
  id: string;
  body: UpdateMealEntryRequest;
}

export type Run = (p: Promise<unknown>) => Promise<void>;

const served = (g: number | null) =>
  g && g > 0 ? { served_quantity: g, unit: 'g' as EntryUnit } : {};

/** Resolve a real meal id, materializing the day first when the slot is still a scaffold. */
export type ResolveMealId = (mealId: string, mealIndex: number) => Promise<string>;
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
export type ResolveEntry = (
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
    // Mobile line-editor bottom sheet (spec §5.3). Opening it closes any open inline picker first.
    openLineSheet: (mealId: string, mealIndex: number, entryId: string) => {
      d.setEditing(null);
      d.setLineSheetTarget({ mealId, mealIndex, entryId });
    },
    closeLineSheet: () => d.setLineSheetTarget(null),
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
            const before = findEntry(d.day, target.entryId);
            await d.day.updateEntry.mutateAsync({
              mealId: target.mealId,
              id: target.entryId,
              body,
            });
            if (before)
              recordUpdate(
                d.recordHistory,
                target.mealId,
                target.entryId,
                {
                  custom_name: before.custom_name ?? undefined,
                  snap: before.snap,
                  served_quantity: before.served_quantity,
                  unit: before.unit,
                },
                body,
              );
          } else {
            const mealId = await resolveMealId(target.mealId, target.mealIndex);
            const entry = await d.day.createEntry.mutateAsync({
              mealId,
              body: {
                kind: 'custom',
                ...body,
                ...(target.orderIndex == null ? {} : { order_index: target.orderIndex }),
              },
            });
            recordAdd(d.recordHistory, mealId, entry);
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
    ...pickActions(d, run, resolveMealId),
    ...editLineActions(d, run, resolveEntry),
    ...customActions(d, run, resolveMealId),
    ...dayActions(d, run),
  };
}

export type MealActions = ReturnType<typeof createMealActions>;
