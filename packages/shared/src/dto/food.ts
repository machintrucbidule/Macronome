import { z } from 'zod';

// Food DTOs (spec/api/foods-recipes.md §Foods). One source for controller
// validation and the web client's request/response types. Field names stay
// snake_case to match the API contract; macros are per 100 g (SI: grams, kcal).

/** Rating: null = unrated, otherwise a 0..3 grade (DECISIONS.md Gap #7). The literal
 * union keeps the inferred type aligned with the shared `Rating` type. */
export const RatingSchema = z
  .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
  .nullable();

export const VisibilitySchema = z.enum(['private', 'shared']);
export const FoodSourceSchema = z.enum(['manual', 'recipe', 'imported']);

// --- Named portions -------------------------------------------------------

export const NamedPortionInputSchema = z.object({
  label: z.string().min(1).max(255),
  grams: z.number().positive(),
});
export type NamedPortionInput = z.infer<typeof NamedPortionInputSchema>;

export const NamedPortionSchema = NamedPortionInputSchema.extend({
  id: z.string().uuid(),
});
export type NamedPortion = z.infer<typeof NamedPortionSchema>;

/** Labels must be unique within one food (spec/schema: UNIQUE(food_id,label)). */
function uniqueLabels(portions: { label: string }[], ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  portions.forEach((p, i) => {
    const key = p.label.trim().toLowerCase();
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'duplicate_label',
        path: [i, 'label'],
      });
    }
    seen.add(key);
  });
}

// --- Full payload (response) ----------------------------------------------

export const FoodSchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string(),
  kcal_per_100g: z.number(),
  fat_per_100g: z.number(),
  carb_per_100g: z.number(),
  protein_per_100g: z.number(),
  comment: z.string().nullable(),
  rating: RatingSchema,
  visibility: VisibilitySchema,
  source: FoodSourceSchema,
  ai_proposable: z.boolean(),
  recipe_id: z.string().uuid().nullable(),
  named_portions: z.array(NamedPortionSchema),
  archived_at: z.string().datetime().nullable(),
  /** 90-day meal-log count (FU-1/B-151) — present only on a usage-sorted list response. */
  usage: z.number().int().optional(),
});
export type Food = z.infer<typeof FoodSchema>;

// --- Create / update requests ---------------------------------------------

const macros = {
  kcal_per_100g: z.number().nonnegative(),
  fat_per_100g: z.number().nonnegative(),
  carb_per_100g: z.number().nonnegative(),
  protein_per_100g: z.number().nonnegative(),
};

export const CreateFoodSchema = z
  .object({
    name: z.string().min(1).max(255),
    ...macros,
    comment: z.string().max(2000).nullish(),
    rating: RatingSchema.optional().default(null),
    visibility: VisibilitySchema.optional().default('private'),
    ai_proposable: z.boolean().optional().default(true),
    named_portions: z.array(NamedPortionInputSchema).optional().default([]),
  })
  .superRefine((body, ctx) => uniqueLabels(body.named_portions, ctx));
export type CreateFoodRequest = z.infer<typeof CreateFoodSchema>;

export const UpdateFoodSchema = z
  .object({
    name: z.string().min(1).max(255),
    ...macros,
    comment: z.string().max(2000).nullish(),
    rating: RatingSchema,
    visibility: VisibilitySchema,
    ai_proposable: z.boolean(),
    named_portions: z.array(NamedPortionInputSchema),
  })
  .partial()
  .superRefine((body, ctx) => {
    if (body.named_portions) uniqueLabels(body.named_portions, ctx);
  });
export type UpdateFoodRequest = z.infer<typeof UpdateFoodSchema>;

// --- Macro-label parser (PM-1/B-114) --------------------------------------

/** Request: the raw nutrition text pasted from a grocery site. */
export const FoodParseLabelRequestSchema = z.object({
  label_text: z.string().min(1).max(10000),
});
export type FoodParseLabelRequest = z.infer<typeof FoodParseLabelRequestSchema>;

/** Deduced per-100 g figures; each field is optional — only the macros found are
 * returned (the client leaves a missing field untouched). See
 * spec/logic/macro-label-parser.md. */
export const FoodParseLabelSchema = z.object({
  kcal_per_100g: z.number().optional(),
  fat_per_100g: z.number().optional(),
  carb_per_100g: z.number().optional(),
  protein_per_100g: z.number().optional(),
});
export type FoodParseLabel = z.infer<typeof FoodParseLabelSchema>;

/** Non-blocking warnings the parser may attach (kJ→kcal fallback, ref scaling, partial). */
export type FoodParseWarning = 'kcal_from_kj' | 'scaled_from_ref' | 'macro_missing';

export interface FoodParseLabelResponse {
  data: FoodParseLabel;
  warnings?: FoodParseWarning[];
}

// --- List / search query --------------------------------------------------

export const FOOD_SORT_FIELDS = [
  'name',
  'kcal',
  'fat',
  'carb',
  'protein',
  'rating',
  'visibility',
  'usage',
] as const;

export const FoodListQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  min_rating: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(1), z.literal(2), z.literal(3)]))
    .optional(),
  visibility: VisibilitySchema.optional(),
  include_archived: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .default(false)
    .transform((v) => v === true || v === 'true'),
  sort: z.enum(FOOD_SORT_FIELDS).optional().default('name'),
  dir: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  cursor: z.string().optional(),
});
export type FoodListQuery = z.infer<typeof FoodListQuerySchema>;

/** List response envelope (spec/api/00-conventions.md §List behaviour). */
export interface FoodListResponse {
  data: Food[];
  next_cursor: string | null;
}

/** Create/update may carry non-blocking warnings (e.g. duplicate_name). */
export interface FoodMutationResponse {
  data: Food;
  warnings?: string[];
}
