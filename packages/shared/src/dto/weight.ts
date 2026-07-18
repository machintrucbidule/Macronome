import { z } from 'zod';

// Weight DTOs (spec/api/weight-targets-stats-settings.md §Weight,
// spec/logic/weight-periods-trajectory.md). Requests are Zod schemas validated at the
// controller; responses are plain interfaces the server builds and the web only renders
// (EMA, trajectory, periods, cartouche are all server-derived). Field names stay
// snake_case to match the API contract. SI units (kg, cm).

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date');

/** Diet flag — describes the period ENDING at the weigh-in; drives the trajectory. */
export const DietFlagSchema = z.enum(['in_diet', 'not_in_diet']);
export type DietFlag = z.infer<typeof DietFlagSchema>;

/** Chart range selector — clips the chart; EMA/trajectory are computed on full history. */
export const WeightRangeSchema = z.enum(['3m', '6m', '1y', 'all']);
export type WeightRange = z.infer<typeof WeightRangeSchema>;

export const WeightRangeQuerySchema = z.object({
  range: WeightRangeSchema.default('all'),
});
export type WeightRangeQuery = z.infer<typeof WeightRangeQuerySchema>;

/** GET /weight/interval-days — a period's inclusive [start,end] date range (B-225). */
export const IntervalDaysQuerySchema = z
  .object({ start: dateString, end: dateString })
  .refine((q) => q.start <= q.end, { message: 'invalid_range' });
export type IntervalDaysQuery = z.infer<typeof IntervalDaysQuerySchema>;

// --- Request schemas -------------------------------------------------------

const weighInFields = {
  date: dateString,
  weight_kg: z.number().positive(),
  waist_cm: z.number().positive().nullish(),
  diet_flag: DietFlagSchema,
  note: z.string().max(2000).nullish(),
};

/** POST /weight — one per day; posting onto an occupied date → 409 + existing_id. */
export const CreateWeighInSchema = z.object(weighInFields);
export type CreateWeighInRequest = z.infer<typeof CreateWeighInSchema>;

/** PATCH /weight/:id — edit (incl. date); re-derives adjacent periods. */
export const PatchWeighInSchema = z
  .object({
    date: dateString.optional(),
    weight_kg: z.number().positive().optional(),
    waist_cm: z.number().positive().nullish(),
    diet_flag: DietFlagSchema.optional(),
    note: z.string().max(2000).nullish(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type PatchWeighInRequest = z.infer<typeof PatchWeighInSchema>;

// --- Response shapes -------------------------------------------------------

/** A stored weigh-in as returned by the API. */
export interface WeighIn {
  id: string;
  date: string;
  weight_kg: number;
  waist_cm: number | null;
  diet_flag: DietFlag;
  note: string | null;
}

/** One point of a derived series (EMA / trajectory), aligned to a weigh-in date. */
export interface WeightPoint {
  date: string;
  value: number;
}

/** One period = span between two consecutive weigh-ins. All figures per-day where
 * applicable; nullable when the source data (logged days, activity) is missing.
 * `open` marks the synthetic open interval (last weigh-in → today, B-176): it has no
 * closing weight, so `weight_end`/`ema`/`delta` (and the other end-weight figures) are null. */
export interface Period {
  start_date: string;
  end_date: string;
  days: number;
  weight_end: number | null;
  ema: number | null;
  delta: number | null;
  ecart_trajectoire: number | null;
  bmi: number | null;
  waist: number | null;
  avg_intake: number | null;
  estimated_burn: number | null;
  empirical_burn: number | null;
  deficit_per_day: number | null;
  avg_activity: number | null;
  diet_flag: DietFlag;
  note: string | null;
  /** True only for the synthetic open interval (last weigh-in → today). */
  open: boolean;
}

/** Projection of the goal date from the recent EMA (only if a goal weight is set and
 * not in Maintien mode). `status` distinguishes a real date from the degraded cases. */
export interface Projection {
  status: 'projected' | 'non_baissiere' | 'atteint' | 'no_goal';
  date: string | null;
  days: number | null;
}

/** BMI category label key (display only; thresholds in logic spec §5). */
export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

/** The five-card état header (spec/api §Weight cartouche). */
export interface Cartouche {
  current: number | null;
  delta_prev: number | null;
  bmi: number | null;
  bmi_category: BmiCategory | null;
  waist: number | null;
  waist_delta: number | null;
  gap_to_goal: number | null;
  projection: Projection;
}

export interface GetWeightResponse {
  weigh_ins: WeighIn[];
  ema: WeightPoint[];
  trajectory: WeightPoint[];
  periods: Period[];
  /** Synthetic open interval (last weigh-in → today), present only when triggered (B-176). */
  open_period: Period | null;
  cartouche: Cartouche;
  /** Persisted Régime/Maintien mode; defaults to the latest period's diet flag (M7). */
  current_mode: DietFlag | null;
}

/** A day's adherence state in the interval recap (B-227): the effective verdict for a detailed
 *  logged day (`ok`/`nok`), `partiel` for a summary (Partiel) day, `none` when not logged. */
export type IntervalDayState = 'ok' | 'partiel' | 'nok' | 'none';

/** One calendar day of a period's interval recap (B-225, enriched B-227). `kcal`/`macros` mirror
 *  the Journal row: `macros` is null on a summary day; all three are null on a day with no
 *  `day_log` row. `state` drives the per-day verdict colour band. */
export interface IntervalDay {
  date: string;
  kcal: number | null;
  macros: { L: number; G: number; P: number } | null;
  comment: string | null;
  state: IntervalDayState;
}

/** Interval-wide recap figures (B-227), server-computed (renders ≠ computes). */
export interface IntervalDaysSummary {
  day_count: number;
  logged_count: number;
  avg_kcal: number | null;
}

/** GET /weight/interval-days — every calendar day of `[start,end]` inclusive, oldest first. */
export interface IntervalDaysResponse {
  data: IntervalDay[];
  summary: IntervalDaysSummary;
}
