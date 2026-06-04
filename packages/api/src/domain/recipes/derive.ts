import type { MacroPer100g } from '../serving/serving.js';

// Recipe derivation (spec/logic/recipes-derived-food.md §3–§5). Pure functions turning
// total macros + batch weight + servings into the per-100 g concentration, the
// per-portion macros/weight, and the derived food a save (re)builds. Full precision;
// display rounding happens at the edge.

export const DERIVED_PORTION_LABEL = 'portion';

/** per100[m] = total_macro[m] / total_batch_grams × 100. */
export function per100(totalMacros: MacroPer100g, batchGrams: number): MacroPer100g {
  const factor = 100 / batchGrams;
  return {
    kcal: totalMacros.kcal * factor,
    fat: totalMacros.fat * factor,
    carb: totalMacros.carb * factor,
    protein: totalMacros.protein * factor,
  };
}

/** per_portion_macro[m] = total_macro[m] / servings (unaffected by batch-weight edits). */
export function perPortion(totalMacros: MacroPer100g, servings: number): MacroPer100g {
  return {
    kcal: totalMacros.kcal / servings,
    fat: totalMacros.fat / servings,
    carb: totalMacros.carb / servings,
    protein: totalMacros.protein / servings,
  };
}

/** weight_per_portion_g = total_batch_grams / servings. */
export function weightPerPortion(batchGrams: number, servings: number): number {
  return batchGrams / servings;
}

export interface DerivedFood {
  /** Per-100 g macros stored on the derived food row. */
  per100g: MacroPer100g;
  /** Auto "portion" named portion = batch / servings. */
  portionLabel: string;
  portionGrams: number;
}

/** Build the derived food a recipe (re)builds on save (§5). */
export function buildDerivedFood(
  totalMacros: MacroPer100g,
  batchGrams: number,
  servings: number,
): DerivedFood {
  return {
    per100g: per100(totalMacros, batchGrams),
    portionLabel: DERIVED_PORTION_LABEL,
    portionGrams: weightPerPortion(batchGrams, servings),
  };
}
