// Derived macro floors (spec/logic/targets-macros.md §3). Entered as grams per kg of
// CURRENT body weight; they recompute as weight changes. Display-only — they never
// enter the calorie-only OK/NOK verdict.

/** Protein floor in grams = protein_g_per_kg × current weight. */
export function proteinFloorG(proteinGPerKg: number, currentWeightKg: number): number {
  return proteinGPerKg * currentWeightKg;
}

/** Fat floor in grams = fat_g_per_kg × current weight. */
export function fatFloorG(fatGPerKg: number, currentWeightKg: number): number {
  return fatGPerKg * currentWeightKg;
}
