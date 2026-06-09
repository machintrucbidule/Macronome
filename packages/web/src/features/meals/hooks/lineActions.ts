import type { EntryUnit, MealEntry, NamedPortion, PantryItem } from '@macronome/shared';
import {
  findEntry,
  mealOrder,
  recordAdd,
  recordPin,
  recordRemove,
  recordReorder,
  recordUpdate,
} from '../history/recordHelpers';
import type { EditTarget, MealActionDeps, ResolveEntry, ResolveMealId, Run } from './mealActions';

// Line-level Repas actions, split out of mealActions to keep each builder under the size caps.
// Each action records its inverse on the undo stack after a successful write (UR-1 / B-133); no
// nutrition is computed here.

/** Default unit when ADDING an item to a meal (B-109): the garde-manger pin's prefill unit wins
 *  (deleted portion → g); else the first named portion (the picker list is `label asc`, and a
 *  recipe carries a single "portion" → its part); else grams. Pure. */
export function resolveEntryDefaultUnit(opts: {
  pin: PantryItem | undefined;
  portions: NamedPortion[];
}): { unit: EntryUnit; portion_id: string | null } {
  const { pin, portions } = opts;
  if (pin) {
    if (pin.unit === 'portion' && !pin.portion_id) return { unit: 'g', portion_id: null };
    return { unit: pin.unit, portion_id: pin.portion_id };
  }
  const first = portions[0];
  if (first) return { unit: 'portion', portion_id: first.id };
  return { unit: 'g', portion_id: null };
}

/** Pick a food from the inline picker: re-pick an existing line (records an update) or add a new
 *  line with the resolved default unit (records an add). */
export function pickActions(d: MealActionDeps, run: Run, resolveMealId: ResolveMealId) {
  return {
    async pickFood(t: EditTarget, foodId: string, portions: NamedPortion[] = []): Promise<void> {
      d.setEditing(null);
      await run(
        (async () => {
          if (t.entryId) {
            const before = findEntry(d.day, t.entryId);
            await d.day.updateEntry.mutateAsync({
              mealId: t.mealId,
              id: t.entryId,
              body: { food_id: foodId },
            });
            d.setPendingFocus(t.entryId);
            if (before?.food_id)
              recordUpdate(
                d.recordHistory,
                t.mealId,
                t.entryId,
                { food_id: before.food_id },
                { food_id: foodId },
              );
          } else {
            const slot = d.day.query.data?.meals.find((m) => m.order_index === t.mealIndex);
            const pin = d.pantry.find(
              (p) => p.meal_slot_name === slot?.slot_name && p.food_id === foodId,
            );
            const def = resolveEntryDefaultUnit({ pin, portions });
            const mealId = await resolveMealId(t.mealId, t.mealIndex);
            const entry = await d.day.createEntry.mutateAsync({
              mealId,
              body: {
                kind: 'referenced',
                food_id: foodId,
                served_quantity: 0,
                unit: def.unit,
                ...(def.portion_id ? { portion_id: def.portion_id } : {}),
                ...(t.orderIndex == null ? {} : { order_index: t.orderIndex }),
              },
            });
            d.setPendingFocus(entry.id);
            recordAdd(d.recordHistory, mealId, entry);
          }
        })(),
      );
    },
  };
}

/** Quantity / unit / delete / pin / reorder on a line. setQty/setUnit take the full entry +
 *  mealIndex so a scaffold pre-fill line (empty ids) is materialized + remapped before the write. */
export function editLineActions(d: MealActionDeps, run: Run, resolveEntry: ResolveEntry) {
  const editLine = (
    mealId: string,
    mealIndex: number,
    entry: MealEntry,
    body: Parameters<typeof d.day.updateEntry.mutateAsync>[0]['body'],
    onDone?: (real: { mealId: string; id: string }) => void,
  ): Promise<void> =>
    run(
      (async () => {
        const real = await resolveEntry(mealId, mealIndex, entry);
        await d.day.updateEntry.mutateAsync({ mealId: real.mealId, id: real.id, body });
        onDone?.(real);
      })(),
    );
  return {
    setQty: (
      mealId: string,
      mealIndex: number,
      entry: MealEntry,
      qty: number,
      unit: EntryUnit,
      portion_id?: string | null,
    ) =>
      editLine(mealId, mealIndex, entry, { served_quantity: qty, unit, portion_id }, (real) =>
        recordUpdate(
          d.recordHistory,
          real.mealId,
          real.id,
          {
            served_quantity: entry.served_quantity,
            unit: entry.unit,
            portion_id: entry.portion_id,
          },
          { served_quantity: qty, unit, portion_id },
        ),
      ),
    setUnit: (
      mealId: string,
      mealIndex: number,
      entry: MealEntry,
      unit: EntryUnit,
      portion_id: string | null,
    ) =>
      editLine(mealId, mealIndex, entry, { unit, portion_id }, (real) =>
        recordUpdate(
          d.recordHistory,
          real.mealId,
          real.id,
          { unit: entry.unit, portion_id: entry.portion_id },
          { unit, portion_id },
        ),
      ),
    // A scaffold pre-fill line (empty id) has nothing persisted to delete → no-op.
    deleteEntry: (mealId: string, id: string) => {
      if (!id) return Promise.resolve();
      const entry = findEntry(d.day, id); // snapshot BEFORE the delete so undo can re-create it
      return run(
        (async () => {
          await d.day.removeEntry.mutateAsync({ mealId, id });
          if (entry) recordRemove(d.recordHistory, mealId, entry);
        })(),
      );
    },
    // Pin/unpin a referenced line as garde-manger (future-day prefill); persisted lines only.
    togglePin: (mealId: string, id: string, pinned: boolean) => {
      const entry = findEntry(d.day, id);
      return run(
        (async () => {
          await (pinned ? d.day.unpinEntry : d.day.pinEntry).mutateAsync({ mealId, id });
          if (entry) recordPin(d.recordHistory, mealId, entry, pinned);
        })(),
      );
    },
    // Drag-reorder a meal's lines (B-029): the full new position map; sparse rows kept.
    reorderEntries: (mealId: string, order: { id: string; order_index: number }[]) => {
      const before = mealOrder(d.day, mealId); // capture the prior order for undo
      return run(
        (async () => {
          await d.day.reorderEntries.mutateAsync({ mealId, body: { order } });
          recordReorder(d.recordHistory, mealId, before, order);
        })(),
      );
    },
  };
}
