import { KCAL_PER_KG } from '@macronome/shared';

// Energy expenditure (spec/logic/metabolic-engine.md §3–4).
// - estimated burn = BMR × activity multiplier (theoretical).
// - empirical burn = avg daily intake + lost_kg × 7700 / days (back-calculated),
//   always PER DAY (RECONCILIATION_LOG §B2), never a period total.

/** Theoretical daily burn = BMR × activity multiplier. */
export function estimatedBurn(bmr: number, activityMultiplier: number): number {
  return bmr * activityMultiplier;
}

export interface EmpiricalBurnInput {
  avgDailyIntake: number;
  weightStartKg: number;
  weightEndKg: number;
  /** Span length in days (≥ 1). */
  days: number;
}

/** Back-calculated daily burn from intake and weight change over the span. */
export function empiricalBurnPerDay({
  avgDailyIntake,
  weightStartKg,
  weightEndKg,
  days,
}: EmpiricalBurnInput): number {
  const lostKg = weightStartKg - weightEndKg; // positive when losing
  return avgDailyIntake + (lostKg * KCAL_PER_KG) / days;
}
