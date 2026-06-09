import { DAY_REPROPOSE_THRESHOLD_G } from '@macronome/shared';
import type { DayMealFoods } from './types.js';

// Day-awareness assembly (spec/logic/ai-meal-suggestions.md §2.2 + §3.1, B-125/B-126/B-127). Pure:
// from the working day's already-eaten entries it produces (1) the `ALREADY ON THE DAY` context
// section the chef reasons over for coherence + complementing the plate, and (2) the set of
// `food_id`s consumed beyond the threshold today, which the service removes from the candidate pool
// so an already-eaten food is never re-proposed (≤ threshold condiments stay proposable).

/** One already-eaten line on the working day. `consumed_grams` is the leftover-adjusted consumed
 *  weight (0 when nothing was eaten); referenced foods carry a `food_id`, custom entries don't. */
export interface DayUsedEntry {
  food_id: string | null;
  custom_name: string | null;
  consumed_grams: number;
}

/** One meal of the working day with its already-eaten entries (order preserved). */
export interface DayUsedMeal {
  meal_name: string;
  entries: DayUsedEntry[];
}

export interface DayUsedResult {
  /** Per-meal foods for the §2.2 ALREADY ON THE DAY context section (empty meals omitted). */
  alreadyOnDay: DayMealFoods[];
  /** `food_id`s whose day-total consumed weight is strictly greater than the threshold (§3.1). */
  excludedFoodIds: string[];
}

/** Resolve a line's display name: custom entries use their own name, referenced foods are looked up
 *  by id; null when unresolvable (deleted food, no custom name) → the line is skipped. */
function lineName(e: DayUsedEntry, nameById: Map<string, string>): string | null {
  if (e.food_id) return nameById.get(e.food_id) ?? null;
  return e.custom_name;
}

/** Build the ALREADY ON THE DAY section + the day-used exclusion set (spec §2.2 / §3.1). Sums
 *  consumed grams per `food_id` across all meals; a food strictly over `thresholdG` is excluded.
 *  Zero/placeholder lines (consumed ≤ 0) and unresolvable names are skipped. */
export function dayUsedFoods(
  meals: DayUsedMeal[],
  nameById: Map<string, string>,
  thresholdG: number = DAY_REPROPOSE_THRESHOLD_G,
): DayUsedResult {
  const usedById = new Map<string, number>();
  const alreadyOnDay: DayMealFoods[] = [];

  for (const meal of meals) {
    const foods: { name: string; qty: string }[] = [];
    for (const e of meal.entries) {
      const grams = e.consumed_grams;
      if (grams <= 0) continue; // nothing eaten (e.g. garde-manger prefill line)
      const name = lineName(e, nameById);
      if (!name) continue; // unresolvable — skip
      foods.push({ name, qty: `${Math.round(grams)} g` });
      if (e.food_id) usedById.set(e.food_id, (usedById.get(e.food_id) ?? 0) + grams);
    }
    if (foods.length > 0) alreadyOnDay.push({ meal_name: meal.meal_name, foods });
  }

  const excludedFoodIds = [...usedById.entries()]
    .filter(([, total]) => total > thresholdG)
    .map(([id]) => id);

  return { alreadyOnDay, excludedFoodIds };
}
