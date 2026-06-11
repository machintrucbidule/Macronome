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

/** A day's calorie-driven state (spec/logic/day-snapshot-verdict.md §8): none (future,
 *  no data) · green (detailed Σ>0) · yellow (summary) · red (past/present, no calorie value).
 *  Derived server-side; the web only renders it (CLAUDE.md rule 2). */
export const DayStateSchema = z.enum(['none', 'green', 'yellow', 'red']);
export type DayState = z.infer<typeof DayStateSchema>;

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

/** One logged food line. `consumed` is derived (served − leftover share); `consumed.quantity`
 *  is that share expressed in the line's own unit (= served_quantity × consumed_grams /
 *  served_grams), so the Qté column can render the consumed amount (B-047). */
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
  consumed: { grams: number | null; quantity: number | null } & MacroSnap;
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
  /** kcal/day from activity ALONE (above BMR = burn − BMR) for each of the 5 activity
   *  levels — powers the activity-help legend (B-026). null when the day has no body
   *  weight (same condition as estimated_burn). */
  per_level_activity_burn: Record<string, number> | null;
}

/** Full detailed-day sheet (spec/api/days-meals-leftover.md §Day → DayDetail). */
export interface DayDetail {
  date: string;
  kind: 'detailed' | 'summary';
  activity_level: string;
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
    activity_level: z.enum(ACTIVITY_LEVELS).optional(),
    comment: z.string().max(2000).nullish(),
    verdict_override: VerdictSchema.nullish(),
    summary_kcal: z.number().nonnegative().nullish(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type PatchDayRequest = z.infer<typeof PatchDaySchema>;

/** POST /days/:date/copy-from — replace the day with a copy of `from` (CP-1 / B-082).
 *  `from` must differ from the target date (checked at the controller). */
export const CopyDaySchema = z.object({ from: dateString });
export type CopyDayRequest = z.infer<typeof CopyDaySchema>;

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

/** POST /meals/:mealId/entries — referenced (food) or custom (manual values).
 *  Optional `order_index` is the line's row position (the UI lets the user add into
 *  any empty row, leaving blank rows above — B-028); omitted = append at the end. */
export const CreateMealEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('referenced'),
    food_id: z.string().uuid(),
    served_quantity: z.number().nonnegative(),
    unit: EntryUnitSchema,
    portion_id: z.string().uuid().nullish(),
    order_index: z.number().int().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal('custom'),
    custom_name: z.string().min(1).max(255),
    served_quantity: z.number().nonnegative().optional(),
    unit: EntryUnitSchema.optional(),
    snap: macroSnapInput,
    order_index: z.number().int().nonnegative().optional(),
  }),
]);
export type CreateMealEntryRequest = z.infer<typeof CreateMealEntrySchema>;

/** PATCH /meals/:mealId/entries/order — reorder a meal's lines (drag grip, B-029).
 *  The full new position map for the meal; order_index may be sparse (blank rows kept). */
export const ReorderEntriesSchema = z.object({
  order: z
    .array(z.object({ id: z.string().uuid(), order_index: z.number().int().nonnegative() }))
    .min(1),
});
export type ReorderEntriesRequest = z.infer<typeof ReorderEntriesSchema>;

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

/** POST /meals/:mealId/leftover/preview — stateless per-line proration for a draft leftover
 *  (B-047). The web sends the already-known tare (catalog or a group's frozen value); the
 *  server does the proportional split (CLAUDE.md rule 2). Persists nothing. */
export const LeftoverPreviewRequestSchema = z.object({
  entry_ids: z.array(z.string().uuid()).min(1),
  gross_grams: z.number().nonnegative(),
  tare_g: z.number().nonnegative(),
});
export type LeftoverPreviewRequest = z.infer<typeof LeftoverPreviewRequestSchema>;

/** One previewed line: served grams in, consumed grams out (after the proration). */
export interface LeftoverPreviewLine {
  entry_id: string;
  served_grams: number;
  consumed_grams: number;
}

export interface LeftoverPreviewResponse {
  net_grams: number;
  served_total: number;
  lines: LeftoverPreviewLine[];
  /** Block reason when the draft is incoherent (same codes the apply enforces), else null. */
  blocked: 'gross_below_tare' | 'leftover_exceeds_served' | null;
}

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
  /** Signed kcal écart vs the day's frozen band, server-computed (B-138): below cal_min →
   *  kcal − cal_min (negative, rendered green); above cal_max → kcal − cal_max (positive, red);
   *  null when inside the band (OK) or on a non-logged (red/empty) day — the web only renders it. */
  kcal_gap: number | null;
  activity_level: string;
  comment: string | null;
  /** The day's kind, or null for an empty (never-touched) trame row (day-model). */
  kind: 'detailed' | 'summary' | null;
  /** Calorie-driven state for the trame coloring (spec/logic/day-snapshot-verdict.md §8). */
  state: DayState;
  /** Whether the Journal Calories cell is inline-editable: any day with no real meal detail
   *  (not green) — typing a total creates/updates a summary (yellow) day. */
  editable_kcal: boolean;
}

export interface JournalResponse {
  data: JournalRow[];
  day_count: number;
  /** Global span of the user's logged days (across all years, independent of the
   *  requested year) — bounds the year selector (B-067). null when no day is logged. */
  min_year: number | null;
  max_year: number | null;
}

export { dateString as DayDateSchema };
