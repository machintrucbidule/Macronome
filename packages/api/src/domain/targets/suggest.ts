import { SUGGEST_RANGE_HALF_WIDTH_KCAL } from '@macronome/shared';

// "Suggérer une cible depuis le déficit visé" (spec/logic/targets-macros.md §5):
// given a desired daily deficit D (negative) and the recent-avg estimated burn B,
// the proposed midpoint intake is round(B + D) and the range is [midpoint − h,
// midpoint + h] with default half-width h = 50 kcal. Opt-in; never auto-writes.

export interface SuggestedRange {
  calorieMin: number;
  calorieMax: number;
}

/** Propose a calorie range from an estimated burn and a desired (negative) deficit. */
export function suggestRange(
  estimatedBurn: number,
  desiredDeficit: number,
  halfWidth: number = SUGGEST_RANGE_HALF_WIDTH_KCAL,
): SuggestedRange {
  const midpoint = Math.round(estimatedBurn + desiredDeficit);
  return { calorieMin: midpoint - halfWidth, calorieMax: midpoint + halfWidth };
}
