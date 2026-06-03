import { ACTIVITY_MULTIPLIERS, DEFAULT_ACTIVITY_LEVEL } from '@macronome/shared';

// Recent-average activity (spec/logic/metabolic-engine.md §3): the mean of the last
// ~30 logged days' activity multipliers, used on Cibles to calibrate a stable target.
// With fewer than one logged day it falls back to sedentary and flags insufficient
// data. The 30-day window selection lives in the service (it needs day_log → M3); this
// pure function just averages whatever multipliers it is given.

export interface RecentActivity {
  multiplier: number;
  /** True when there was no logged day and the sedentary fallback was used. */
  insufficientData: boolean;
}

/** Mean of the supplied daily activity multipliers, or the sedentary fallback. */
export function recentAvgActivity(multipliers: number[]): RecentActivity {
  if (multipliers.length < 1) {
    return { multiplier: ACTIVITY_MULTIPLIERS[DEFAULT_ACTIVITY_LEVEL], insufficientData: true };
  }
  const mean = multipliers.reduce((sum, m) => sum + m, 0) / multipliers.length;
  return { multiplier: mean, insufficientData: false };
}
