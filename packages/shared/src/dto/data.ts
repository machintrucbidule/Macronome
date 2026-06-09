import { z } from 'zod';
import { EntryUnitSchema } from './day.js';

// Data export / import envelope (IMP-1 — spec/api/data-export-import.md). A versioned,
// portable JSON snapshot of all of one user's data, MINUS credentials. Export builds it;
// import validates it then REPLACES the account's data with it (restore semantics). Keys are
// snake_case to mirror the data-schema contract; Decimal columns travel as numbers, DATE
// columns as `YYYY-MM-DD`, instants as ISO-8601. This DTO is the single validation source —
// the controller Zod-parses the upload before any service runs (CLAUDE.md rule 5).

export const DATA_EXPORT_FORMAT_VERSION = 1;

const dateStr = z.string(); // YYYY-MM-DD (DATE) or ISO-8601 (instant); parsed server-side
const jsonValue: z.ZodType = z.unknown();

const ProfileSchema = z.object({
  sex: z.string(),
  birthdate: dateStr,
  height_cm: z.number(),
});

const MealTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  order_index: z.number().int(),
  created_at: dateStr,
});

const ContainerSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalized_name: z.string(),
  empty_weight_g: z.number(),
  is_builtin: z.boolean(),
  created_at: dateStr,
});

const FoodSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalized_name: z.string(),
  kcal_per_100g: z.number(),
  fat_per_100g: z.number(),
  carb_per_100g: z.number(),
  protein_per_100g: z.number(),
  comment: z.string().nullable(),
  rating: z.number().int().nullable(),
  visibility: z.string(),
  source: z.string(),
  // B-123 "Dispo IA"; optional+default so pre-B-123 envelopes still import (restored as true).
  ai_proposable: z.boolean().optional().default(true),
  recipe_id: z.string().nullable(),
  archived_at: dateStr.nullable(),
  created_at: dateStr,
});

const FoodPortionSchema = z.object({
  id: z.string(),
  food_id: z.string(),
  label: z.string(),
  grams: z.number(),
  created_at: dateStr,
});

const RecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalized_name: z.string(),
  instructions: z.string().nullable(),
  total_batch_grams: z.number(),
  // RW-1; optional+default so pre-RW-1 envelopes still import (restored as manual).
  batch_weight_auto: z.boolean().optional().default(false),
  servings: z.number().int(),
  rating: z.number().int().nullable(),
  archived_at: dateStr.nullable(),
  created_at: dateStr,
});

const RecipeIngredientSchema = z.object({
  id: z.string(),
  recipe_id: z.string(),
  ref_type: z.string(),
  ref_food_id: z.string().nullable(),
  ref_recipe_id: z.string().nullable(),
  quantity: z.number(),
  unit: z.string(),
  portion_id: z.string().nullable(),
  order_index: z.number().int(),
});

const PantryItemSchema = z.object({
  id: z.string(),
  meal_slot_name: z.string(),
  food_id: z.string(),
  // GM-2 prefill unit; optional+default so pre-GM-2 envelopes still import (restored as 'g').
  unit: EntryUnitSchema.optional().default('g'),
  portion_id: z.string().nullable().optional().default(null),
  order_index: z.number().int(),
  created_at: dateStr,
});

const WeightEntrySchema = z.object({
  id: z.string(),
  date: dateStr,
  weight_kg: z.number(),
  waist_cm: z.number().nullable(),
  diet_flag: z.string(),
  note: z.string().nullable(),
  created_at: dateStr,
});

const TargetSchema = z.object({
  id: z.string(),
  calorie_min: z.number().int(),
  calorie_max: z.number().int(),
  protein_g_per_kg: z.number(),
  fat_g_per_kg: z.number(),
  target_weight_kg: z.number().nullable(),
  rate_kg_per_week: z.number().nullable(),
  effective_from: dateStr,
  created_at: dateStr,
});

const DayLogSchema = z.object({
  id: z.string(),
  date: dateStr,
  kind: z.string(),
  summary_kcal: z.number().nullable(),
  activity_level: z.string(),
  comment: z.string().nullable(),
  verdict_auto: z.string().nullable(),
  verdict_override: z.string().nullable(),
  target_snapshot: jsonValue,
  created_at: dateStr,
});

const MealSchema = z.object({
  id: z.string(),
  day_log_id: z.string(),
  slot_name: z.string(),
  order_index: z.number().int(),
  created_at: dateStr,
});

const MealEntrySchema = z.object({
  id: z.string(),
  meal_id: z.string(),
  kind: z.string(),
  food_id: z.string().nullable(),
  custom_name: z.string().nullable(),
  served_quantity: z.number(),
  unit: z.string(),
  portion_id: z.string().nullable(),
  served_grams: z.number().nullable(),
  snap_kcal: z.number(),
  snap_fat: z.number(),
  snap_carb: z.number(),
  snap_protein: z.number(),
  order_index: z.number().int(),
  created_at: dateStr,
});

const LeftoverGroupSchema = z.object({
  id: z.string(),
  meal_id: z.string(),
  container_name: z.string(),
  tare_g: z.number(),
  gross_grams: z.number(),
  created_at: dateStr,
});

const LeftoverGroupEntrySchema = z.object({
  leftover_group_id: z.string(),
  meal_entry_id: z.string(),
});

/** The full export/import envelope. `format_version` gates compatibility. */
export const DataExportEnvelopeSchema = z.object({
  format_version: z.number().int(),
  exported_at: z.string(),
  profile: ProfileSchema,
  settings: jsonValue,
  meal_templates: z.array(MealTemplateSchema),
  containers: z.array(ContainerSchema),
  foods: z.array(FoodSchema),
  food_portions: z.array(FoodPortionSchema),
  recipes: z.array(RecipeSchema),
  recipe_ingredients: z.array(RecipeIngredientSchema),
  pantry_items: z.array(PantryItemSchema),
  weight_entries: z.array(WeightEntrySchema),
  targets: z.array(TargetSchema),
  day_logs: z.array(DayLogSchema),
  meals: z.array(MealSchema),
  meal_entries: z.array(MealEntrySchema),
  leftover_groups: z.array(LeftoverGroupSchema),
  leftover_group_entries: z.array(LeftoverGroupEntrySchema),
});

export type DataExportEnvelope = z.infer<typeof DataExportEnvelopeSchema>;

/** POST /data/wipe and POST /data/import response. */
export interface DataMutationResult {
  ok: boolean;
}
