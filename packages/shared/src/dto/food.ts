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

/** Provenance of a food (B-290). `recipe` is server-owned (only the derived-food writer sets
 * it), so it is excluded from what a client may declare — see `CreateFoodSourceSchema`. */
export const FoodSourceSchema = z.enum(['manual', 'recipe', 'ciqual', 'chronodrive']);
export type FoodSource = z.infer<typeof FoodSourceSchema>;

/** The subset a client may declare on `POST /foods` / `PATCH /foods/:id`: how the food came to be. */
export const CreateFoodSourceSchema = z.enum(['manual', 'ciqual', 'chronodrive']);
export type CreateFoodSource = z.infer<typeof CreateFoodSourceSchema>;

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
  /** 90-day consumed-meal-log count (FU-1/B-151; consumed = served_quantity > 0, B-157).
   *  Present on every Foods list response, all sorts (B-156); absent on single-food reads. */
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
    // Provenance: how the draft was built (B-290).
    source: CreateFoodSourceSchema.optional().default('manual'),
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
    // Never rewritten as a side effect of an edit — the food form sends the value it was
    // hydrated with — but the user may deliberately correct it (B-295).
    source: CreateFoodSourceSchema,
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
  'source',
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
  // Provenance filter (B-291). `recipe` is deliberately not accepted: recipe-derived foods are
  // excluded from this list by construction, so it could only ever return nothing.
  source: CreateFoodSourceSchema.optional(),
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
  /**
   * How many foods match the query's filters, independent of `limit`/`cursor` (B-278). The client
   * reserves the height of the rows it has not loaded yet, so the scrollbar spans the catalogue
   * from the first page, and shows the figure in the toolbar.
   */
  total: number;
  /**
   * The provenance values actually present in the user's catalog — sorted, `recipe` excluded,
   * archived foods included, and computed **independently of this query's own filters** (B-295).
   * The client offers a Source filter only for the values listed here, and hides the filter
   * altogether below two: a stable set that does not shift while the user types.
   */
  sources: FoodSource[];
}

/** Create/update may carry non-blocking warnings (e.g. duplicate_name). */
export interface FoodMutationResponse {
  data: Food;
  warnings?: string[];
}
