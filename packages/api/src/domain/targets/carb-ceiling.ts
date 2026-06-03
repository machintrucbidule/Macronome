import { KCAL_PER_G } from '@macronome/shared';

// Derived carb ceiling (spec/logic/targets-macros.md §3–4):
//   carb_ceiling_g = (calorie_max − protein_floor_g×4 − fat_floor_g×9) / 4.
// EDGE (§4): the result MAY be ≤ 0 when the protein + fat floors already meet/exceed
// calorie_max. It is returned as-is — NEVER clamped to 0, NEVER throws — and the
// caller surfaces a "targets inconsistent" warning without blocking the save.

export interface CarbCeilingInput {
  calorieMax: number;
  proteinFloorG: number;
  fatFloorG: number;
}

/** Remainder carb ceiling in grams. May be ≤ 0 (inconsistent targets); not clamped. */
export function carbCeilingG({ calorieMax, proteinFloorG, fatFloorG }: CarbCeilingInput): number {
  const proteinKcal = proteinFloorG * KCAL_PER_G.protein;
  const fatKcal = fatFloorG * KCAL_PER_G.fat;
  return (calorieMax - proteinKcal - fatKcal) / KCAL_PER_G.carb;
}
