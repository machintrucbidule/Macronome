import type { Meal, MealEntry } from '@macronome/shared';

// Selection-sum logic for the Repas Σ readout (B-207). The web NEVER computes a nutrition figure
// (CLAUDE.md rule 2): this is a pure ADDITION of the per-line `consumed` values the rows already hold
// (server-computed), a client-side ephemeral display aggregate — never persisted, never authoritative.
// See DECISIONS.md B-207 (precedent: B-139 client-side écart derivation, useLeftoverForm.servedTotal).

export interface SelectionSum {
  grams: number;
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
}

export const EMPTY_SUM: SelectionSum = { grams: 0, kcal: 0, fat: 0, carb: 0, protein: 0 };

/** A line can be selected unless it is a greyed qty-0 garde-manger scaffold (mirrors FoodLine's
 *  `isZero` muting and useLeftoverForm's exclusion of weightless lines). Empty rows carry no entry. */
export function isSelectableEntry(entry: MealEntry): boolean {
  const isPantryScaffold =
    entry.kind !== 'custom' && entry.served_quantity === 0 && entry.is_pinned;
  return !isPantryScaffold;
}

/** The selectable entry ids of a meal (used to toggle a whole meal via its footer). */
export function eligibleIds(meal: Meal): string[] {
  return meal.entries.filter(isSelectableEntry).map((e) => e.id);
}

/** Sum the `consumed` values of the selected entries across all meals. The selection is a
 *  `Set<entry_id>`, so a line reached both directly and via its meal total counts once (no
 *  double-count). Null consumed grams contribute 0. Full precision; the caller rounds at render. */
export function selectionSum(meals: Meal[], selected: Set<string>): SelectionSum {
  if (selected.size === 0) return { ...EMPTY_SUM };
  const sum: SelectionSum = { ...EMPTY_SUM };
  for (const meal of meals) {
    for (const entry of meal.entries) {
      if (!selected.has(entry.id)) continue;
      const c = entry.consumed;
      sum.grams += c.grams ?? 0;
      sum.kcal += c.kcal;
      sum.fat += c.fat;
      sum.carb += c.carb;
      sum.protein += c.protein;
    }
  }
  return sum;
}
