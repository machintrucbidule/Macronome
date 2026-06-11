// Day calorie total + CALORIE-ONLY auto verdict with manual override
// (spec/logic/day-snapshot-verdict.md §4–6). Pure: no DB, no request. Macros NEVER
// enter the auto verdict; the override is the lever for macro/quality adherence.

export type Verdict = 'OK' | 'NOK';

/** Calorie status word for the calorie card (SOUS < min, OK in-range, DEPASSE > max). */
export type CalorieStatus = 'SOUS' | 'OK' | 'DEPASSE';

/** Day calorie total = sum of the per-entry consumed kcal (summary days pass [kcal]). */
export function dayKcal(consumedKcals: number[]): number {
  return consumedKcals.reduce((sum, k) => sum + k, 0);
}

/** Where the day's calories fall relative to the snapshot range. */
export function calorieStatus(kcal: number, calMin: number, calMax: number): CalorieStatus {
  if (kcal < calMin) return 'SOUS';
  if (kcal > calMax) return 'DEPASSE';
  return 'OK';
}

/** Auto verdict: OK iff cal_min ≤ day_kcal ≤ cal_max, else NOK (below OR above). */
export function autoVerdict(kcal: number, calMin: number, calMax: number): Verdict {
  return calorieStatus(kcal, calMin, calMax) === 'OK' ? 'OK' : 'NOK';
}

/** Signed kcal écart vs the **upper target** (B-138): `kcal − cal_max`, always relative to the
 *  ceiling — negative at/under it (incl. inside the band, a headroom), positive when over it.
 *  Caller decides when to surface it (logged days only); it is shown even on an in-band OK day. */
export function kcalUpperGap(kcal: number, calMax: number): number {
  return kcal - calMax;
}

/** Effective verdict = manual override if set, else the auto value (00-conventions.md). */
export function effectiveVerdict(override: Verdict | null, auto: Verdict | null): Verdict | null {
  return override ?? auto;
}
