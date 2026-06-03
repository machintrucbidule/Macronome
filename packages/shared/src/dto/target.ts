import { z } from 'zod';

// Targets & metabolic-engine DTOs (spec/api/weight-targets-stats-settings.md
// §Targets). The calorie range + macro ratios are the manual inputs; the engine
// readout is fully derived server-side (logic/metabolic-engine.md, targets-macros.md)
// and the web only renders it. Field names stay snake_case to match the API contract.

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date');

// --- Manual target (request + response) -----------------------------------

/** Shared field shapes (domain: 0 < calorie_min ≤ calorie_max; ratios ≥ 0). */
const targetFields = {
  calorie_min: z.number().int().positive(),
  calorie_max: z.number().int().positive(),
  protein_g_per_kg: z.number().nonnegative(),
  fat_g_per_kg: z.number().nonnegative(),
  target_weight_kg: z.number().positive().nullish(),
  rate_kg_per_week: z.number().nonnegative().nullish(),
  effective_from: dateString,
};

export const CreateTargetSchema = z
  .object(targetFields)
  .refine((b) => b.calorie_max >= b.calorie_min, {
    message: 'calorie_max_below_min',
    path: ['calorie_max'],
  });
export type CreateTargetRequest = z.infer<typeof CreateTargetSchema>;

/** Persisted target as returned by the API (carbs are never stored — derived). */
export const TargetSchema = z.object({
  calorie_min: z.number(),
  calorie_max: z.number(),
  protein_g_per_kg: z.number(),
  fat_g_per_kg: z.number(),
  target_weight_kg: z.number().nullable(),
  rate_kg_per_week: z.number().nullable(),
  effective_from: z.string(),
});
export type Target = z.infer<typeof TargetSchema>;

// --- Engine readout (all derived; nullable when a source is missing) -------

/** Non-blocking warning codes carried by GET/POST /target (not errors). */
export const TargetWarning = {
  /** protein + fat floors already meet/exceed calorie_max (targets-macros.md §4). */
  CarbCeilingNonPositive: 'carb_ceiling_non_positive',
  /** no logged day yet → recent-avg activity fell back to sedentary (engine §3). */
  InsufficientActivityData: 'insufficient_activity_data',
  /** no weigh-in yet → weight-dependent figures are not computable (engine/targets §2). */
  NoWeight: 'no_weight',
} as const;
export type TargetWarningCode = (typeof TargetWarning)[keyof typeof TargetWarning];

/** The live metabolic readout shown on Cibles. Full precision; the web rounds. */
export interface EngineReadout {
  age: number | null;
  bmr: number | null;
  current_weight_kg: number | null;
  recent_avg_activity: number | null;
  estimated_burn: number | null;
  empirical_burn: number | null;
  protein_floor_g: number | null;
  fat_floor_g: number | null;
  carb_ceiling_g: number | null;
  deficit_at_target: number | null;
  kg_per_week: number | null;
}

export interface GetTargetResponse {
  target: Target | null;
  engine: EngineReadout;
  warnings: TargetWarningCode[];
}

// --- Suggest a target from a desired deficit (opt-in; never auto-writes) ----

export const SuggestTargetSchema = z.object({
  /** Desired daily deficit (negative kcal/day for a real deficit). */
  desired_deficit: z.number(),
});
export type SuggestTargetRequest = z.infer<typeof SuggestTargetSchema>;

export interface SuggestTargetResponse {
  calorie_min: number;
  calorie_max: number;
}
