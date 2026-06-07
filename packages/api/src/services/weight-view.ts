import type {
  Cartouche,
  DietFlag,
  GetWeightResponse,
  Period,
  Projection,
  WeighIn,
  WeightPoint,
  WeightRange,
} from '@macronome/shared';
import type { WeightEntry as WeightEntryModel } from '@prisma/client';
import type { ProfileRow } from '../data/repositories/profile.repo.js';
import {
  bmi,
  bmiCategory,
  deriveEma,
  derivePeriods,
  deriveTrajectory,
  ecart,
  projectGoalDate,
  rateAsOf,
  type ProjectionPoint,
  type TargetRate,
  type WeighInInput,
} from '../domain/weight/index.js';
import { periodMetabolics, type LoggedDay } from './weight-periods.js';

// Read-model assembly for GET /weight (spec/api §Weight). Pure shaping over the user's
// weigh-ins + profile + target + logged days: EMA and trajectory on the full history,
// per-period stats, the cartouche, and the goal projection. The range only clips the
// chart series; periods + cartouche use the full history (logic/weight-periods-trajectory.md).

const MS_PER_DAY = 86_400_000;
const RANGE_WINDOW_DAYS: Record<Exclude<WeightRange, 'all'>, number> = {
  '3m': 90,
  '6m': 180,
  '1y': 365,
};

const num = (d: { toString(): string }): number => Number(d.toString());
const iso = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (date: string, days: number): string =>
  iso(new Date(Date.parse(date) + Math.round(days) * MS_PER_DAY));

export interface WeightViewInput {
  entries: WeightEntryModel[];
  profile: ProfileRow;
  /** Target versions (effective_from + rate); the trajectory resolves the rate per period
   * from this history (B-099). Empty → trajectory stays flat. */
  targetRates: TargetRate[];
  /** Goal weight (caps the trajectory + enables the projection); null when unset. */
  goalWeight: number | null;
  loggedDays: LoggedDay[];
  range: WeightRange;
  /** Persisted Régime/Maintien mode (app_user.settings); null = use the latest period flag. */
  currentMode: DietFlag | null;
}

/** Project the goal date from the recent EMA window (last ≤4 points, ≥2 required). The
 * Maintien gate is applied server-side (M7): when the effective mode is 'not_in_diet' the
 * projection is suppressed (logic/weight-periods-trajectory.md §6, §7). */
function buildProjection(
  emaFull: WeightPoint[],
  goalWeight: number | null,
  maintien: boolean,
): Projection {
  if (goalWeight === null || emaFull.length < 2)
    return { status: 'no_goal', date: null, days: null };
  const recent = emaFull.slice(-4);
  const origin = Date.parse(recent[0]!.date);
  const points: ProjectionPoint[] = recent.map((p) => ({
    x: (Date.parse(p.date) - origin) / MS_PER_DAY,
    y: p.value,
  }));
  const result = projectGoalDate({ points, goalWeight, maintien });
  const latest = emaFull[emaFull.length - 1]!.date;
  const date =
    result.status === 'projected' && result.days !== null ? addDays(latest, result.days) : null;
  return { status: result.status, date, days: result.days };
}

/** Difference a − b, or null when either side is missing (cartouche deltas/gap). */
function delta(a: number | null, b: number | null): number | null {
  return a !== null && b !== null ? a - b : null;
}

function buildCartouche(
  inputs: WeighInInput[],
  emaFull: WeightPoint[],
  heightCm: number,
  goalWeight: number | null,
  maintien: boolean,
): Cartouche {
  const last = inputs.at(-1) ?? null;
  const prev = inputs.length >= 2 ? inputs[inputs.length - 2]! : null;
  const current = last ? last.weightKg : null;
  const bmiVal = current !== null ? bmi(current, heightCm) : null;
  const waist = last ? last.waistCm : null;
  return {
    current,
    delta_prev: delta(current, prev ? prev.weightKg : null),
    bmi: bmiVal,
    bmi_category: bmiVal !== null ? bmiCategory(bmiVal) : null,
    waist,
    waist_delta: delta(waist, prev ? prev.waistCm : null),
    gap_to_goal: delta(current, goalWeight),
    projection: buildProjection(emaFull, goalWeight, maintien),
  };
}

function rangeCutoff(range: WeightRange, inputs: WeighInInput[]): string | null {
  if (range === 'all' || inputs.length === 0) return null;
  return addDays(inputs[inputs.length - 1]!.date, -RANGE_WINDOW_DAYS[range]);
}

/** Assemble the full GET /weight response from the stored rows. */
export function buildWeightView({
  entries,
  profile,
  targetRates,
  goalWeight,
  loggedDays,
  range,
  currentMode,
}: WeightViewInput): GetWeightResponse {
  const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const inputs: WeighInInput[] = sorted.map((e) => ({
    date: iso(e.date),
    weightKg: num(e.weightKg),
    waistCm: e.waistCm === null ? null : num(e.waistCm),
    dietFlag: e.dietFlag as DietFlag,
    note: e.note,
  }));
  const weighIns: WeighIn[] = sorted.map((e) => ({
    id: e.id,
    date: iso(e.date),
    weight_kg: num(e.weightKg),
    waist_cm: e.waistCm === null ? null : num(e.waistCm),
    diet_flag: e.dietFlag as DietFlag,
    note: e.note,
  }));

  const emaValues = deriveEma(inputs.map((i) => i.weightKg));
  const rawPeriods = derivePeriods(inputs);
  const trajValues = deriveTrajectory({
    anchor: inputs[0]?.weightKg ?? 0,
    // Resolve the rate per period from the target effective on the period's end date
    // (the weigh-in that closes it — consistent with how dietFlag is taken). B-099.
    periods: rawPeriods.map((p) => ({
      days: p.days,
      dietFlag: p.dietFlag,
      rateKgPerWeek: rateAsOf(targetRates, p.endDate),
    })),
    goalWeight,
  });
  const emaFull: WeightPoint[] = inputs.map((i, idx) => ({ date: i.date, value: emaValues[idx]! }));
  const trajFull: WeightPoint[] = inputs.map((i, idx) => ({
    date: i.date,
    value: trajValues[idx]!,
  }));

  const heightCm = num(profile.heightCm);
  const periods: Period[] = rawPeriods
    .map((rp, idx): Period => {
      const metab = periodMetabolics(rp, loggedDays, profile);
      return {
        start_date: rp.startDate,
        end_date: rp.endDate,
        days: rp.days,
        weight_end: rp.weightEnd,
        ema: emaValues[idx + 1]!,
        delta: rp.weightEnd - rp.weightStart,
        ecart_trajectoire: ecart(rp.weightEnd, trajValues[idx + 1]!),
        bmi: bmi(rp.weightEnd, heightCm),
        waist: rp.waist,
        avg_intake: metab.avg_intake,
        estimated_burn: metab.estimated_burn,
        empirical_burn: metab.empirical_burn,
        deficit_per_day: metab.deficit_per_day,
        avg_activity: metab.avg_activity,
        diet_flag: rp.dietFlag,
        note: rp.note,
      };
    })
    .reverse(); // newest first (table order)

  const cutoff = rangeCutoff(range, inputs);
  const clip = <T extends { date: string }>(arr: T[]): T[] =>
    cutoff ? arr.filter((p) => p.date >= cutoff) : arr;

  // The effective mode prefers the persisted setting, falling back to the latest period's
  // diet flag (the M4 default). 'not_in_diet' is Maintien — it gates the projection.
  const latestFlag = inputs.length ? inputs[inputs.length - 1]!.dietFlag : null;
  const effectiveMode = currentMode ?? latestFlag;
  const maintien = effectiveMode === 'not_in_diet';

  return {
    weigh_ins: clip(weighIns),
    ema: clip(emaFull),
    trajectory: clip(trajFull),
    periods,
    cartouche: buildCartouche(inputs, emaFull, heightCm, goalWeight, maintien),
    current_mode: effectiveMode,
  };
}
