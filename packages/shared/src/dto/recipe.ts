import { z } from 'zod';
import { NamedPortionSchema, RatingSchema } from './food.js';
import { CatalogLocaleSchema } from './food-ref.js';

// Recipe DTOs (spec/api/foods-recipes.md §Recipes). One source for controller
// validation and the web client's types. Field names stay snake_case to match the API
// contract. Per-100 g / per-portion macros are computed server-side
// (spec/logic/recipes-derived-food.md) and only ever returned, never posted.

export const RecipeRefTypeSchema = z.enum(['food', 'recipe']);
export type RecipeRefType = z.infer<typeof RecipeRefTypeSchema>;
export const RecipeUnitSchema = z.enum(['g', 'ml', 'kg', 'portion']);
export type RecipeUnit = z.infer<typeof RecipeUnitSchema>;

/** Derived macros block (per-100 g or per-portion). */
export const MacrosSchema = z.object({
  kcal: z.number(),
  fat: z.number(),
  carb: z.number(),
  protein: z.number(),
});
export type Macros = z.infer<typeof MacrosSchema>;

// --- Ingredient input (request) -------------------------------------------

export const RecipeIngredientInputSchema = z
  .object({
    ref_type: RecipeRefTypeSchema,
    ref_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit: RecipeUnitSchema,
    portion_id: z.string().uuid().nullish(),
    order_index: z.number().int().nonnegative(),
  })
  .superRefine((ing, ctx) => {
    if (ing.unit === 'portion' && !ing.portion_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'portion_id_required',
        path: ['portion_id'],
      });
    }
  });
export type RecipeIngredientInput = z.infer<typeof RecipeIngredientInputSchema>;

// --- Ingredient (response, resolved server-side) --------------------------

export const RecipeIngredientSchema = z.object({
  id: z.string().uuid(),
  ref_type: RecipeRefTypeSchema,
  ref_id: z.string().uuid(),
  ref_name: z.string(),
  quantity: z.number(),
  unit: RecipeUnitSchema,
  portion_id: z.string().uuid().nullable(),
  order_index: z.number().int(),
  grams: z.number(),
  kcal: z.number(),
  fat: z.number(),
  carb: z.number(),
  protein: z.number(),
  /** The referenced item's named portions, for the unit menu (only if it has any). */
  ref_named_portions: z.array(NamedPortionSchema),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

// --- Recipe summary (list row) --------------------------------------------

export const RecipeSummarySchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  name: z.string(),
  kcal_per_100g: z.number(),
  fat_per_100g: z.number(),
  carb_per_100g: z.number(),
  protein_per_100g: z.number(),
  total_batch_grams: z.number(),
  /** RW-1: true ⇒ the server keeps total_batch_grams = Σ ingredient grams. */
  batch_weight_auto: z.boolean(),
  servings: z.number().int(),
  weight_per_portion_g: z.number(),
  rating: RatingSchema,
  derived_food_id: z.string().uuid().nullable(),
  archived_at: z.string().datetime().nullable(),
});
export type RecipeSummary = z.infer<typeof RecipeSummarySchema>;

// --- Recipe full (builder view) -------------------------------------------

export const RecipeFullSchema = RecipeSummarySchema.extend({
  instructions: z.string().nullable(),
  total_ingredient_grams: z.number(),
  per_portion: MacrosSchema,
  ingredients: z.array(RecipeIngredientSchema),
});
export type RecipeFull = z.infer<typeof RecipeFullSchema>;

// --- Create / update requests ---------------------------------------------

const recipeBody = {
  name: z.string().min(1).max(255),
  instructions: z.string().max(10000).nullish(),
  rating: RatingSchema.optional().default(null),
  total_batch_grams: z.number().positive().optional(),
  /** RW-1: true ⇒ server-maintained batch = Σ (then total_batch_grams must be absent).
   *  Create default: true iff total_batch_grams is absent. PATCH default: stored state. */
  batch_weight_auto: z.boolean().optional(),
  servings: z.number().int().min(1),
  ingredients: z.array(RecipeIngredientInputSchema),
};

const noBatchWhenAuto = (
  val: { batch_weight_auto?: boolean | undefined; total_batch_grams?: number | undefined },
  ctx: z.RefinementCtx,
): void => {
  if (val.batch_weight_auto === true && val.total_batch_grams !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'conflicts_with_auto',
      path: ['total_batch_grams'],
    });
  }
};

export const CreateRecipeSchema = z.object(recipeBody).superRefine(noBatchWhenAuto);
export type CreateRecipeRequest = z.infer<typeof CreateRecipeSchema>;

export const UpdateRecipeSchema = z.object(recipeBody).partial().superRefine(noBatchWhenAuto);
export type UpdateRecipeRequest = z.infer<typeof UpdateRecipeSchema>;

// --- Preview request / response (stateless live recompute) ----------------
// Same body as create, minus `name` (an unsaved draft needs no name to compute its
// figures). Read-only: nothing is persisted (spec/api/foods-recipes.md §Recipes), so
// preview ingredient lines carry no persisted `id`.

export const RecipePreviewRequestSchema = z.object({
  total_batch_grams: recipeBody.total_batch_grams,
  servings: recipeBody.servings,
  ingredients: recipeBody.ingredients,
});
export type RecipePreviewRequest = z.infer<typeof RecipePreviewRequestSchema>;

export const RecipePreviewIngredientSchema = RecipeIngredientSchema.omit({ id: true });
export type RecipePreviewIngredient = z.infer<typeof RecipePreviewIngredientSchema>;

export const RecipePreviewSchema = z.object({
  total_ingredient_grams: z.number(),
  total_batch_grams: z.number(),
  servings: z.number().int(),
  kcal_per_100g: z.number(),
  fat_per_100g: z.number(),
  carb_per_100g: z.number(),
  protein_per_100g: z.number(),
  weight_per_portion_g: z.number(),
  total_macros: MacrosSchema,
  per_portion: MacrosSchema,
  ingredients: z.array(RecipePreviewIngredientSchema),
});
export type RecipePreview = z.infer<typeof RecipePreviewSchema>;

export interface RecipePreviewResponse {
  data: RecipePreview;
}

// --- List / search query --------------------------------------------------

// Recipe-native sort fields only. Derived macro columns live on the derived food row,
// not the recipe table, so they are not keyset-sortable here (cf. foods' "Portion NOT
// sortable", OPEN_GAPS #10); the screen shows them as non-sortable columns.
export const RECIPE_SORT_FIELDS = ['name', 'batch', 'servings', 'rating'] as const;

export const RecipeListQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  min_rating: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(1), z.literal(2), z.literal(3)]))
    .optional(),
  include_archived: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .default(false)
    .transform((v) => v === true || v === 'true'),
  sort: z.enum(RECIPE_SORT_FIELDS).optional().default('name'),
  dir: z.enum(['asc', 'desc']).optional().default('asc'),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  cursor: z.string().optional(),
});
export type RecipeListQuery = z.infer<typeof RecipeListQuerySchema>;

export interface RecipeListResponse {
  data: RecipeSummary[];
  next_cursor: string | null;
  /** Recipes matching the query's filters, independent of `limit`/`cursor` (B-278, see food.ts). */
  total: number;
}

export interface RecipeMutationResponse {
  data: RecipeFull;
  warnings?: string[];
}

// --- Combined log search (food ∪ recipe-derived food) ---------------------

/**
 * Where a search hit comes from (B-293). A discriminator, not a label: `own` items carry a real
 * `food.id`, `ciqual_ref` items carry a `food_ref.id` — which is NOT a food id and must never be
 * sent to an endpoint expecting one. Picking a reference entry adopts it first
 * (`POST /foods/from-ref`) and continues with the food that comes back.
 */
export const LoggableOriginSchema = z.enum(['own', 'ciqual_ref']);
export type LoggableOrigin = z.infer<typeof LoggableOriginSchema>;

export const LoggableItemSchema = z.object({
  /** The loggable food id (a recipe-derived food when kind='recipe'; a food_ref id when
   *  origin='ciqual_ref'). */
  id: z.string().uuid(),
  name: z.string(),
  kind: z.enum(['food', 'recipe']),
  origin: LoggableOriginSchema,
  /** The source recipe id when kind='recipe' (for recipe-ingredient references). */
  recipe_id: z.string().uuid().nullable(),
  named_portions: z.array(NamedPortionSchema),
});
export type LoggableItem = z.infer<typeof LoggableItemSchema>;

export const LoggableSearchQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
  /** Which language a reference entry is returned under, and which name the duplicate rule
   *  compares — same role as on the reference catalog (D6). */
  locale: CatalogLocaleSchema.optional().default('fr'),
});
export type LoggableSearchQuery = z.infer<typeof LoggableSearchQuerySchema>;

export interface LoggableSearchResponse {
  data: LoggableItem[];
}
