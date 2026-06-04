import { z } from 'zod';
import { NamedPortionSchema } from './food.js';

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
  servings: z.number().int(),
  weight_per_portion_g: z.number(),
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
  total_batch_grams: z.number().positive().optional(),
  servings: z.number().int().min(1),
  ingredients: z.array(RecipeIngredientInputSchema),
};

export const CreateRecipeSchema = z.object(recipeBody);
export type CreateRecipeRequest = z.infer<typeof CreateRecipeSchema>;

export const UpdateRecipeSchema = z.object(recipeBody).partial();
export type UpdateRecipeRequest = z.infer<typeof UpdateRecipeSchema>;

// --- List / search query --------------------------------------------------

// Recipe-native sort fields only. Derived macro columns live on the derived food row,
// not the recipe table, so they are not keyset-sortable here (cf. foods' "Portion NOT
// sortable", OPEN_GAPS #10); the screen shows them as non-sortable columns.
export const RECIPE_SORT_FIELDS = ['name', 'batch', 'servings'] as const;

export const RecipeListQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
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
}

export interface RecipeMutationResponse {
  data: RecipeFull;
  warnings?: string[];
}

// --- Combined log search (food ∪ recipe-derived food) ---------------------

export const LoggableItemSchema = z.object({
  /** The loggable food id (a recipe-derived food when kind='recipe'). */
  id: z.string().uuid(),
  name: z.string(),
  kind: z.enum(['food', 'recipe']),
  /** The source recipe id when kind='recipe' (for recipe-ingredient references). */
  recipe_id: z.string().uuid().nullable(),
  named_portions: z.array(NamedPortionSchema),
});
export type LoggableItem = z.infer<typeof LoggableItemSchema>;

export const LoggableSearchQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  limit: z.coerce.number().int().positive().max(50).optional().default(20),
});
export type LoggableSearchQuery = z.infer<typeof LoggableSearchQuerySchema>;

export interface LoggableSearchResponse {
  data: LoggableItem[];
}
