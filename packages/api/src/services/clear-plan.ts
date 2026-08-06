import type { MealAggregate } from '../data/repositories/day-read.repo.js';
import { pinKey } from './day-assembler.js';

// The "what a clear does to a line" rule, in one place (B-046 for the day, MC-1/B-296 for one
// meal). Both callers hand it meal aggregates and the live pantry pins and get back the three
// buckets `dayRepo.clearDay` writes; the difference between them is only WHICH meals they pass
// and which mode they ask for. Keeping it here is what makes "the per-meal clear applies the
// day-clear partition, scoped to the meal" true by construction rather than by copy.

/** A pin's stored prefill unit — what a cleared garde-manger line reverts to (GM-2/B-092). */
export interface PinPrefill {
  unit: string;
  portionId: string | null;
}

export interface ClearBuckets {
  groupIds: string[];
  deleteEntryIds: string[];
  zeroEntries: { id: string; unit: string; portionId: string | null }[];
}

type PantryPin = {
  mealSlotName: string;
  foodId: string;
  unit: string;
  portionId: string | null;
};

/** `(slot, food)` → the unit a cleared line of that pin resets to. `portion` without a stored
 *  portion id cannot be honoured, so it falls back to grams. */
export function pinPrefillMap(pins: PantryPin[]): Map<string, PinPrefill> {
  return new Map(
    pins.map((p) => [
      pinKey(p.mealSlotName, p.foodId),
      p.unit === 'portion' && p.portionId
        ? { unit: 'portion', portionId: p.portionId }
        : { unit: p.unit === 'portion' ? 'g' : p.unit, portionId: null },
    ]),
  );
}

/**
 * Split the given meals into the delete / keep-at-zero / drop-group buckets.
 *
 * `mode: 'delete'` keeps **only** a garde-manger line — its own `pinned` flag set AND its food
 * still in the live pantry set for that slot (B-198; a manually re-added duplicate is a normal
 * line and goes) — and resets it to the pin's prefill unit at qty 0. Everything else is deleted.
 *
 * `mode: 'zero'` deletes nothing: every line is kept and zeroed, preserving its own unit, portion
 * and pin — the meal-wide form of the line-level "Remettre à zéro" (B-249).
 *
 * Leftover groups are dropped in both modes: a proration whose quantities are gone is meaningless,
 * and an empty group holding a frozen container value must never be left behind (D4).
 */
export function planClear(
  meals: MealAggregate[],
  pinByKey: Map<string, PinPrefill>,
  mode: 'delete' | 'zero',
): ClearBuckets {
  const buckets: ClearBuckets = { groupIds: [], deleteEntryIds: [], zeroEntries: [] };
  for (const { meal, entries, groups } of meals) {
    for (const g of groups) buckets.groupIds.push(g.group.id);
    for (const e of entries) {
      if (mode === 'zero') {
        buckets.zeroEntries.push({ id: e.id, unit: e.unit, portionId: e.portionId });
        continue;
      }
      const pin =
        e.kind === 'referenced' && e.foodId !== null && e.pinned
          ? pinByKey.get(pinKey(meal.slotName, e.foodId))
          : undefined;
      if (pin) buckets.zeroEntries.push({ id: e.id, unit: pin.unit, portionId: pin.portionId });
      else buckets.deleteEntryIds.push(e.id);
    }
  }
  return buckets;
}

/** True when the plan would write nothing — the caller can answer without touching the DB. */
export function isNoOp(b: ClearBuckets): boolean {
  return b.groupIds.length === 0 && b.deleteEntryIds.length === 0 && b.zeroEntries.length === 0;
}
