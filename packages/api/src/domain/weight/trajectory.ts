import type { DietFlag } from '@macronome/shared';

// Target trajectory — broken line (spec/logic/weight-periods-trajectory.md §4).
// Anchored on the first weigh-in's real weight, built forward period by period from each
// period's diet flag: in_diet slopes down at the target rate (capped at the goal),
// not_in_diet stays flat. One trajectory point per weigh-in (anchor + one per period).
// The rate is resolved PER PERIOD from the target in effect on that period's date
// (targets are versioned by effective_from), so the slope changes at each rate boundary
// instead of drawing the whole history at the current rate (B-099).

const DAYS_PER_WEEK = 7;

export interface TrajectoryPeriod {
  days: number;
  dietFlag: DietFlag;
  /** Target loss rate effective for this period (kg/week); 0 → flat (B-099). */
  rateKgPerWeek: number;
}

export interface TrajectoryInput {
  /** Real weight of the very first weigh-in (the anchor). */
  anchor: number;
  /** Periods in date order (one per consecutive weigh-in pair). */
  periods: TrajectoryPeriod[];
  /** Goal weight cap; null = no floor. */
  goalWeight: number | null;
}

/** A target version's effective date (ISO) and its loss rate — input for rateAsOf. */
export interface TargetRate {
  effectiveFrom: string;
  rateKgPerWeek: number;
}

/**
 * Rate effective as of `date`: the latest `effective_from ≤ date`. When `date` precedes
 * every target the **earliest** target applies (retroactive — mirrors targetRepo.currentAsOf
 * / B-090). Returns 0 when there is no target at all (trajectory then stays flat).
 */
export function rateAsOf(targets: TargetRate[], date: string): number {
  if (targets.length === 0) return 0;
  const sorted = [...targets].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let rate = sorted[0]!.rateKgPerWeek; // earliest as the retroactive fallback
  for (const t of sorted) {
    if (t.effectiveFrom <= date) rate = t.rateKgPerWeek;
    else break;
  }
  return rate;
}

/** Broken-line trajectory: returns anchor + one point per period (length = periods+1). */
export function deriveTrajectory({ anchor, periods, goalWeight }: TrajectoryInput): number[] {
  const traj: number[] = [anchor];
  for (const period of periods) {
    const prev = traj[traj.length - 1]!;
    if (period.dietFlag === 'in_diet') {
      const drop = (period.rateKgPerWeek * period.days) / DAYS_PER_WEEK;
      const next = prev - drop;
      traj.push(goalWeight === null ? next : Math.max(next, goalWeight));
    } else {
      traj.push(prev); // not_in_diet → flat
    }
  }
  return traj;
}

/** Écart à la trajectoire = real weight − trajectory at the same weigh-in. */
export function ecart(realWeight: number, trajectory: number): number {
  return realWeight - trajectory;
}
