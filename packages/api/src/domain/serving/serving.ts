// Serving resolution (spec/logic/00-conventions.md §Units). Pure functions that turn a
// logged quantity + unit into grams, and per-100 g macros into the served-quantity macro
// snapshot frozen on a meal_entry. No DB, no request. Grams are the internal unit; there
// is no density field on a food, so the only coherent reading of the contract is
// 1 ml = 1 g (like 'g'); 'kg' ×1000; 'portion' multiplies by the named portion's grams.

export type ServingUnit = 'g' | 'ml' | 'kg' | 'portion';

export interface MacroPer100g {
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
}

export type MacroSnapshot = MacroPer100g;

export interface ServedGramsInput {
  unit: ServingUnit;
  quantity: number;
  /** Required (and only used) when unit === 'portion'. */
  portionGrams?: number | null;
}

/** Resolve a logged quantity + unit to grams. */
export function resolveServedGrams({ unit, quantity, portionGrams }: ServedGramsInput): number {
  switch (unit) {
    case 'g':
    case 'ml':
      return quantity; // 1 ml = 1 g (no density data exists in the schema)
    case 'kg':
      return quantity * 1000;
    case 'portion':
      if (portionGrams == null) throw new Error('portion_grams_required');
      return quantity * portionGrams;
  }
}

/** Macro snapshot for `grams` of a food given its per-100 g macros. Full precision. */
export function snapshotMacros(per100g: MacroPer100g, grams: number): MacroSnapshot {
  const factor = grams / 100;
  return {
    kcal: per100g.kcal * factor,
    fat: per100g.fat * factor,
    carb: per100g.carb * factor,
    protein: per100g.protein * factor,
  };
}
