import type { DietFlag } from '@macronome/shared';

// Target trajectory — broken line (spec/logic/weight-periods-trajectory.md §4).
// Anchored on the first weigh-in's real weight, built forward period by period from each
// period's diet flag: in_diet slopes down at the target rate (capped at the goal),
// not_in_diet stays flat. One trajectory point per weigh-in (anchor + one per period).

const DAYS_PER_WEEK = 7;

export interface TrajectoryPeriod {
  days: number;
  dietFlag: DietFlag;
}

export interface TrajectoryInput {
  /** Real weight of the very first weigh-in (the anchor). */
  anchor: number;
  /** Periods in date order (one per consecutive weigh-in pair). */
  periods: TrajectoryPeriod[];
  /** Target loss rate from the Target (kg/week). */
  rateKgPerWeek: number;
  /** Goal weight cap; null = no floor. */
  goalWeight: number | null;
}

/** Broken-line trajectory: returns anchor + one point per period (length = periods+1). */
export function deriveTrajectory({
  anchor,
  periods,
  rateKgPerWeek,
  goalWeight,
}: TrajectoryInput): number[] {
  const traj: number[] = [anchor];
  for (const period of periods) {
    const prev = traj[traj.length - 1]!;
    if (period.dietFlag === 'in_diet') {
      const drop = (rateKgPerWeek * period.days) / DAYS_PER_WEEK;
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
