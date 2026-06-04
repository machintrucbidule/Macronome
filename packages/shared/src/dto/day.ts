import { z } from 'zod';
import { ACTIVITY_LEVELS } from '../constants/activity.js';

// Daily-log DTOs (spec/api/days-meals-leftover.md). Responses are plain interfaces
// the server builds and the web only renders (no client computation); requests are
// Zod schemas validated at the controller. Field names stay snake_case (API contract).
// All derived figures (consumed, totals, constat, verdicts) are server-computed.

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date');

/** Calorie verdict — OK / NOK (calorie-only auto; manual override shares the scale). */
export const VerdictSchema = z.enum(['OK', 'NOK']);
export type Verdict = z.infer<typeof VerdictSchema>;

/** Logged-entry unit (SI; 'portion' resolves to grams via a food_portion). */
export const EntryUnitSchema = z.enum(['g', 'ml', 'kg', 'portion']);
export type EntryUnit = z.infer<typeof EntryUnitSchema>;

// --- Response shapes -------------------------------------------------------

/** The target values frozen on a day (cal range + macro thresholds; OPEN_GAPS #1). */
export interface TargetSnapshot {
  cal_min: number;
  cal_max: number;
  protein_floor_g: number | null;
  fat_floor_g: number | null;
  carb_ceiling_g: number | null;
}

export interface MacroSnap {
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
}

/** One logged food line. `consumed` is derived (served − leftover share). */
export interface MealEntry {
  id: string;
  kind: 'referenced' | 'custom';
  food_id: string | null;
  custom_name: string | null;
  served_quantity: number;
  unit: EntryUnit;
  portion_id: string | null;
  served_grams: number | null;
  snap: MacroSnap;
  consumed: { grams: number | null } & MacroSnap;
  is_pinned: boolean;
  order_index: number;
}

/** A shared-plate leftover group (frozen container value + the prorated subset). */
export interface LeftoverGroup {
  id: string;
  container_name: string;
  tare_g: number;
  gross_grams: number;
  leftover_net_grams: number;
  entry_ids: string[];
}

export interface MealTotals {
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
  weight_g: number;
}

export interface Meal {
  id: string;
  slot_name: string;
  order_index: number;
  entries: MealEntry[];
  leftover_groups: LeftoverGroup[];
  totals: MealTotals;
}

/** The per-day activity constat shown beside the verdict (derived, never stored). */
export interface DayConstat {
  estimated_burn: number | null;
  deficit: number | null;
  kg_per_week: number | null;
}

/** Full detailed-day sheet (spec/api/days-meals-leftover.md §Day → DayDetail). */
export interface DayDetail {
  date: string;
  kind: 'detailed' | 'summary';
  activity_level: string | null;
  comment: string | null;
  verdict_auto: Verdict | null;
  verdict_override: Verdict | null;
  effective_verdict: Verdict | null;
  summary_kcal?: number | null;
  target_snapshot: TargetSnapshot;
  totals: MealTotals;
  constat: DayConstat;
  meals: Meal[];
}

// --- Request schemas -------------------------------------------------------

/** PATCH /days/:date — day-level fields. verdict_override null = revert to auto. */
export const PatchDaySchema = z
  .object({
    activity_level: z.enum(ACTIVITY_LEVELS).nullish(),
    comment: z.string().max(2000).nullish(),
    verdict_override: VerdictSchema.nullish(),
    summary_kcal: z.number().nonnegative().nullish(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type PatchDayRequest = z.infer<typeof PatchDaySchema>;

export const CreateMealSchema = z.object({
  slot_name: z.string().min(1).max(255),
  order_index: z.number().int().nonnegative(),
});
export type CreateMealRequest = z.infer<typeof CreateMealSchema>;

export const PatchMealSchema = z
  .object({
    slot_name: z.string().min(1).max(255).optional(),
    order_index: z.number().int().nonnegative().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type PatchMealRequest = z.infer<typeof PatchMealSchema>;

const macroSnapInput = z.object({
  kcal: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  carb: z.number().nonnegative(),
  protein: z.number().nonnegative(),
});

/** POST /meals/:mealId/entries — referenced (food) or custom (manual values). */
export const CreateMealEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('referenced'),
    food_id: z.string().uuid(),
    served_quantity: z.number().nonnegative(),
    unit: EntryUnitSchema,
    portion_id: z.string().uuid().nullish(),
  }),
  z.object({
    kind: z.literal('custom'),
    custom_name: z.string().min(1).max(255),
    served_quantity: z.number().nonnegative().optional(),
    unit: EntryUnitSchema.optional(),
    snap: macroSnapInput,
  }),
]);
export type CreateMealEntryRequest = z.infer<typeof CreateMealEntrySchema>;

/** PATCH /meals/:mealId/entries/:id — change qty/unit/food or custom values. */
export const UpdateMealEntrySchema = z
  .object({
    food_id: z.string().uuid().optional(),
    custom_name: z.string().min(1).max(255).optional(),
    served_quantity: z.number().nonnegative().optional(),
    unit: EntryUnitSchema.optional(),
    portion_id: z.string().uuid().nullish(),
    snap: macroSnapInput.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type UpdateMealEntryRequest = z.infer<typeof UpdateMealEntrySchema>;

/** POST /meals/:mealId/leftover — container null = built-in "Rien" (tare 0). */
export const LeftoverRequestSchema = z.object({
  container_id: z.string().uuid().nullable(),
  gross_grams: z.number().nonnegative(),
  entry_ids: z.array(z.string().uuid()).min(1),
});
export type LeftoverRequest = z.infer<typeof LeftoverRequestSchema>;

/** PATCH /leftover/:groupId — re-edit gross/container/selection. */
export const PatchLeftoverSchema = z
  .object({
    container_id: z.string().uuid().nullable().optional(),
    gross_grams: z.number().nonnegative().optional(),
    entry_ids: z.array(z.string().uuid()).min(1).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type PatchLeftoverRequest = z.infer<typeof PatchLeftoverSchema>;

/** GET /journal?year=YYYY — one row per logged day, newest first. */
export const JournalQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
export type JournalQuery = z.infer<typeof JournalQuerySchema>;

export interface JournalRow {
  date: string;
  kcal: number;
  macros: { L: number; G: number; P: number } | null;
  verdict_auto: Verdict | null;
  verdict_override: Verdict | null;
  effective_verdict: Verdict | null;
  activity_level: string | null;
  comment: string | null;
  kind: 'detailed' | 'summary';
}

export interface JournalResponse {
  data: JournalRow[];
  day_count: number;
}

export { dateString as DayDateSchema };
