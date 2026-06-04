import {
  resolveServedGrams,
  snapshotMacros,
  type MacroPer100g,
  type ServingUnit,
} from '../serving/serving.js';

// Recipe aggregation (spec/logic/recipes-derived-food.md §1, §3). Pure: turns each
// ingredient (referenced item's per-100 g macros + quantity/unit) into its resolved
// grams + macro contribution, then sums them. A nested recipe contributes via its own
// derived per-100 g macros — the caller passes those in `per100g`. No DB, no request.

export interface IngredientInput {
  /** The referenced food's (or nested recipe's derived) per-100 g macros. */
  per100g: MacroPer100g;
  quantity: number;
  unit: ServingUnit;
  /** Required only when unit === 'portion'. */
  portionGrams?: number | null;
}

export interface IngredientLine {
  grams: number;
  macros: MacroPer100g;
}

export interface AggregateResult {
  totalIngredientGrams: number;
  totalMacros: MacroPer100g;
  lines: IngredientLine[];
}

const ZERO: MacroPer100g = { kcal: 0, fat: 0, carb: 0, protein: 0 };

export function aggregateMacros(ingredients: IngredientInput[]): AggregateResult {
  const lines: IngredientLine[] = ingredients.map((ing) => {
    const grams = resolveServedGrams({
      unit: ing.unit,
      quantity: ing.quantity,
      portionGrams: ing.portionGrams ?? null,
    });
    return { grams, macros: snapshotMacros(ing.per100g, grams) };
  });
  const totalMacros = lines.reduce<MacroPer100g>(
    (acc, l) => ({
      kcal: acc.kcal + l.macros.kcal,
      fat: acc.fat + l.macros.fat,
      carb: acc.carb + l.macros.carb,
      protein: acc.protein + l.macros.protein,
    }),
    { ...ZERO },
  );
  const totalIngredientGrams = lines.reduce((sum, l) => sum + l.grams, 0);
  return { totalIngredientGrams, totalMacros, lines };
}
