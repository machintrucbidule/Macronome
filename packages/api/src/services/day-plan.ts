import type { DayAggregate } from '../data/repositories/day-read.repo.js';
import type { CopyMealData } from '../data/repositories/day-copy.repo.js';

// The faithful-copy mapping: a stored day aggregate → the plan shape `dayCopyRepo` rebuilds
// from. Pure (no I/O, no service imports), because three callers need it and two of them must
// not depend on `days.ts`: the whole-day copy (CP-1/B-082), the per-meal copy (CP-2/B-248) and
// the undo restore point (B-261). Extracting it here is what keeps those import chains acyclic.
//
// "Faithful" means values, not references: frozen macro snapshots, the per-line garde-manger
// flag, and each leftover group's already-frozen container_name + tare_g. That is why an undo
// can restore leftovers at all — the catalog container id is not part of the stored history.

const num = (d: { toString(): string }): number => Number(d.toString());

/** Whether a meal carries something worth copying: at least one served line (a qty-0
 *  garde-manger placeholder is not content). */
export function mealHasContent(meal: DayAggregate['meals'][number]): boolean {
  return meal.entries.some((e) => num(e.servedQuantity) > 0);
}

/** Map one stored meal → the plan's meal (entries + leftover groups, remapping each group's
 *  entry ids to positional indexes the repo rewires to the rows it creates). */
export function planMeal({ meal, entries, groups }: DayAggregate['meals'][number]): CopyMealData {
  const indexById = new Map(entries.map((e, i) => [e.id, i]));
  return {
    slotName: meal.slotName,
    orderIndex: meal.orderIndex,
    entries: entries.map((e) => ({
      kind: e.kind,
      foodId: e.foodId,
      customName: e.customName,
      servedQuantity: num(e.servedQuantity),
      unit: e.unit,
      portionId: e.portionId,
      servedGrams: e.servedGrams === null ? null : num(e.servedGrams),
      snapKcal: num(e.snapKcal),
      snapFat: num(e.snapFat),
      snapCarb: num(e.snapCarb),
      snapProtein: num(e.snapProtein),
      orderIndex: e.orderIndex,
      pinned: e.pinned, // preserve the per-line garde-manger flag (B-198); pantry_item untouched
    })),
    groups: groups.map(({ group, entryIds }) => ({
      containerName: group.containerName,
      tareG: num(group.tareG),
      grossGrams: num(group.grossGrams),
      entryIndexes: entryIds.map((id) => indexById.get(id) ?? -1),
    })),
  };
}

/** Map every meal of an aggregate (the whole-day plan). */
export function planMeals(source: DayAggregate): CopyMealData[] {
  return source.meals.map(planMeal);
}
