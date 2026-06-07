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
  id: z.string(),
  calorie_min: z.number(),
  calorie_max: z.number(),
  protein_g_per_kg: z.number(),
  fat_g_per_kg: z.number(),
  target_weight_kg: z.number().nullable(),
  rate_kg_per_week: z.number().nullable(),
  effective_from: z.string(),
});
export type Target = z.infer<typeof TargetSchema>;

// --- Target history (versions list + edit; TH-1 / B-091) -------------------
// Targets are versioned by effective_from (one row per date). The history endpoints
// expose the full list with a computed period end (`until`) and let any version be
// edited/deleted (spec/api/weight-targets-stats-settings.md §Targets, DECISIONS TH-1).

/** One target version with its period end: `until` = day before the next version's
 * effective_from, or null for the current (latest) version. */
export const TargetVersionSchema = TargetSchema.extend({
  until: z.string().nullable(),
});
export type TargetVersion = z.infer<typeof TargetVersionSchema>;

export interface GetTargetHistoryResponse {
  versions: TargetVersion[];
}

/** PATCH /targets/:id — edit any field of a version, including its effective_from
 * (back-datable). All optional; the service validates calorie_max ≥ calorie_min on the
 * merged row. A date colliding with another version → 409 target_date_occupied. */
export const PatchTargetSchema = z
  .object({
    calorie_min: targetFields.calorie_min.optional(),
    calorie_max: targetFields.calorie_max.optional(),
    protein_g_per_kg: targetFields.protein_g_per_kg.optional(),
    fat_g_per_kg: targetFields.fat_g_per_kg.optional(),
    target_weight_kg: targetFields.target_weight_kg,
    rate_kg_per_week: targetFields.rate_kg_per_week,
    effective_from: targetFields.effective_from.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' })
  .refine(
    (b) =>
      b.calorie_min === undefined || b.calorie_max === undefined || b.calorie_max >= b.calorie_min,
    {
      message: 'calorie_max_below_min',
      path: ['calorie_max'],
    },
  );
export type PatchTargetRequest = z.infer<typeof PatchTargetSchema>;

// --- Recompute a version's window (opt-in, auto-only; DECISIONS TH-1) -------
// Re-freezes target_snapshot + recomputes verdict_auto for logged days with no override
// in the affected window (day-snapshot-verdict.md §3). Optional from/to override the
// natural window to cover an effective_from edit's union span.

export const RecomputeTargetSchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});
export type RecomputeTargetRequest = z.infer<typeof RecomputeTargetSchema>;

export interface RecomputeTargetResponse {
  recomputed: number;
}

export interface RecomputeCountResponse {
  count: number;
}

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
  /** target_weight_kg / (height_m)²; null when no target weight (targets-macros.md §6). */
  target_bmi: number | null;
}

export interface GetTargetResponse {
  target: Target | null;
  engine: EngineReadout;
  warnings: TargetWarningCode[];
}

// --- Live preview of the engine from a draft (unsaved) target ----------------
// Stateless recompute for the Cibles form (targets-macros.md, DECISIONS B-042),
// mirroring POST /recipes/preview (B-035). Same numeric fields as a create; nothing is
// persisted. `effective_from` is optional (TH-1): when present the engine is computed
// AS OF that date (weight/age/recent-activity window resolved on that date) so the
// history editor's right panel reflects the version's period, not today.

export const TargetPreviewSchema = z
  .object({
    calorie_min: targetFields.calorie_min,
    calorie_max: targetFields.calorie_max,
    protein_g_per_kg: targetFields.protein_g_per_kg,
    fat_g_per_kg: targetFields.fat_g_per_kg,
    target_weight_kg: targetFields.target_weight_kg,
    rate_kg_per_week: targetFields.rate_kg_per_week,
    effective_from: targetFields.effective_from.optional(),
  })
  .refine((b) => b.calorie_max >= b.calorie_min, {
    message: 'calorie_max_below_min',
    path: ['calorie_max'],
  });
export type PreviewTargetRequest = z.infer<typeof TargetPreviewSchema>;

export interface PreviewTargetResponse {
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
