import { KCAL_PER_KG } from '@macronome/shared';

// Deficit (spec/logic/metabolic-engine.md §5–6, 00-conventions.md §"Sign conventions").
// Sign convention: deficit = intake − burn → negative is a real deficit, positive a
// surplus. The burn term is the ESTIMATED burn (BMR × activity), never the empirical
// one. The Cibles "deficit at target" uses the midpoint of the calorie range.

const DAYS_PER_WEEK = 7;

/** Daily deficit = avg intake − estimated burn (negative = real deficit). */
export function deficitPerDay(avgDailyIntake: number, estimatedBurn: number): number {
  return avgDailyIntake - estimatedBurn;
}

/** kg/week equivalent of a daily deficit (negative deficit → weight loss). */
export function kgPerWeek(deficitPerDay: number): number {
  return (deficitPerDay / KCAL_PER_KG) * DAYS_PER_WEEK;
}

/** Reference intake for the "deficit at target" constat: midpoint of the range. */
export function calorieMidpoint(calorieMin: number, calorieMax: number): number {
  return (calorieMin + calorieMax) / 2;
}

/** Cibles constat: midpoint intake − estimated burn (recent-avg activity). */
export function deficitAtTarget(calorieMidpoint: number, estimatedBurn: number): number {
  return calorieMidpoint - estimatedBurn;
}
