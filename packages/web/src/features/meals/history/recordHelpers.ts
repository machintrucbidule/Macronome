import type { MealEntry, UpdateMealEntryRequest } from '@macronome/shared';
import type { UseDay } from '../hooks/useDay';
import { snapshotOf, type Op, type OrderItem } from './op';

// Thin helpers so mealActions can record undo ops in one line each (UR-1 / B-133). The cache is
// the source of truth, so "before" state is read from it before a mutation; the created id comes
// from the createEntry result. Each dispatcher is a no-op when no recorder is wired.

type Record = ((op: Op) => void) | undefined;

/** Find a cached entry by id across the day's meals (its pre-edit state, to snapshot). */
export function findEntry(day: UseDay, id: string): MealEntry | undefined {
  for (const m of day.query.data?.meals ?? []) {
    const e = m.entries.find((x) => x.id === id);
    if (e) return e;
  }
  return undefined;
}

/** The current id→order_index map for a meal (the pre-reorder state). */
export function mealOrder(day: UseDay, mealId: string): OrderItem[] {
  const m = day.query.data?.meals.find((mm) => mm.id === mealId);
  return (m?.entries ?? []).map((e) => ({ id: e.id, order_index: e.order_index }));
}

export const recordAdd = (rec: Record, mealId: string, entry: MealEntry): void =>
  rec?.({ type: 'add', mealId, entryId: entry.id, snapshot: snapshotOf(entry) });

export const recordRemove = (rec: Record, mealId: string, entry: MealEntry): void =>
  rec?.({ type: 'remove', mealId, entryId: entry.id, snapshot: snapshotOf(entry) });

export const recordUpdate = (
  rec: Record,
  mealId: string,
  id: string,
  before: UpdateMealEntryRequest,
  after: UpdateMealEntryRequest,
): void => rec?.({ type: 'update', mealId, entryId: id, before, after });

export const recordPin = (
  rec: Record,
  mealId: string,
  entry: MealEntry,
  pinnedBefore: boolean,
): void =>
  rec?.({ type: 'pin', mealId, entryId: entry.id, pinnedBefore, snapshot: snapshotOf(entry) });

export const recordMove = (
  rec: Record,
  sourceMealId: string,
  entry: MealEntry,
  targetMealId: string,
  toOrderIndex: number,
): void =>
  rec?.({
    type: 'move',
    mealId: sourceMealId,
    entryId: entry.id,
    targetMealId,
    fromOrderIndex: entry.order_index,
    toOrderIndex,
  });

export const recordReorder = (
  rec: Record,
  mealId: string,
  before: OrderItem[],
  after: OrderItem[],
): void => rec?.({ type: 'reorder', mealId, before, after });
