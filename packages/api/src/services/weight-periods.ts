import {
  ACTIVITY_MULTIPLIERS,
  type ActivityLevel,
  DEFAULT_ACTIVITY_LEVEL,
  type Sex,
} from '@macronome/shared';
import type { DayAggregate } from '../data/repositories/day-read.repo.js';
import type { ProfileRow } from '../data/repositories/profile.repo.js';
import {
  ageYears,
  deficitPerDay,
  empiricalBurnPerDay,
  estimatedBurn,
  mifflinStJeor,
} from '../domain/metabolic/index.js';
import type { RawPeriod } from '../domain/weight/index.js';
import { computeDayTotals } from './day-assembler.js';

// Per-period intake/burn/deficit (spec/logic/weight-periods-trajectory.md §2). These are
// the only Weight-screen figures that depend on day_log (M3): the rest of the period row
// (EMA, trajectory, écart, BMI, Δ) is series maths assembled in weight-view.ts. No maths is
// reinvented here — it reuses the metabolic domain over the logged days of each span.

const num = (d: { toString(): string }): number => Number(d.toString());

export interface LoggedDay {
  date: string;
  kcal: number;
  activityLevel: string | null;
}

/** kcal + activity of one logged day (summary days use their stored summary_kcal). */
export function loggedDay(aggregate: DayAggregate): LoggedDay {
  const { dayLog } = aggregate;
  const isSummary = dayLog.kind === 'summary';
  const kcal = isSummary ? num(dayLog.summaryKcal ?? 0) : computeDayTotals(aggregate).kcal;
  return {
    date: dayLog.date.toISOString().slice(0, 10),
    kcal,
    activityLevel: dayLog.activityLevel,
  };
}

export interface PeriodMetabolics {
  avg_intake: number | null;
  avg_activity: number | null;
  estimated_burn: number | null;
  empirical_burn: number | null;
  deficit_per_day: number | null;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/** Intake/burn/deficit over a period's logged days. The span is (start, end]; estimated
 * burn always uses weight_end + the period's mean activity (sedentary fallback + no flag
 * when no day in the span carries an activity level). Intake-derived figures are null when
 * the span has no logged day. */
export function periodMetabolics(
  period: RawPeriod,
  loggedDays: LoggedDay[],
  profile: ProfileRow,
): PeriodMetabolics {
  const inSpan = loggedDays.filter((d) => d.date > period.startDate && d.date <= period.endDate);
  const avgIntake = mean(inSpan.map((d) => d.kcal));
  const avgActivity = mean(
    inSpan
      .filter((d) => d.activityLevel !== null)
      .map((d) => ACTIVITY_MULTIPLIERS[d.activityLevel as ActivityLevel]),
  );
  const burnMultiplier = avgActivity ?? ACTIVITY_MULTIPLIERS[DEFAULT_ACTIVITY_LEVEL];
  const bmr = mifflinStJeor({
    weightKg: period.weightEnd,
    heightCm: num(profile.heightCm),
    ageYears: ageYears(profile.birthdate, new Date(`${period.endDate}T00:00:00.000Z`)),
    sex: profile.sex as Sex,
  });
  const burn = estimatedBurn(bmr, burnMultiplier);
  return {
    avg_intake: avgIntake,
    avg_activity: avgActivity,
    estimated_burn: burn,
    empirical_burn:
      avgIntake === null
        ? null
        : empiricalBurnPerDay({
            avgDailyIntake: avgIntake,
            weightStartKg: period.weightStart,
            weightEndKg: period.weightEnd,
            days: period.days,
          }),
    deficit_per_day: avgIntake === null ? null : deficitPerDay(avgIntake, burn),
  };
}
