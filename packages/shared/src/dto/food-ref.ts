import { z } from 'zod';
import { offsetField, rejectCursorWithOffset } from './pagination.js';

// Ciqual reference-catalog DTOs (spec/api/foods-recipes.md §Food reference catalog, B-292).
// Read-only: there is no create/update shape. Field names stay snake_case to match the API
// contract; macros are per 100 g (SI: grams, kcal).

/** Which language drives the name sort, the group labels and the `already_owned` probe. */
export const CatalogLocaleSchema = z.enum(['fr', 'en']);
export type CatalogLocale = z.infer<typeof CatalogLocaleSchema>;

export const FoodRefSchema = z.object({
  id: z.string().uuid(),
  /** The source table's food code (Ciqual `alim_code`), text because it is zero-padded. */
  code: z.string(),
  name_fr: z.string(),
  name_eng: z.string(),
  group_label_fr: z.string(),
  group_label_eng: z.string(),
  kcal_per_100g: z.number(),
  fat_per_100g: z.number(),
  carb_per_100g: z.number(),
  protein_per_100g: z.number(),
  /** kcal derived from the macros rather than published (spec/logic/ciqual-catalog.md §4.2). */
  energy_derived: z.boolean(),
  /** The user already has an ACTIVE food of this name — marked, never blocking (D11). */
  already_owned: z.boolean(),
});
export type FoodRef = z.infer<typeof FoodRefSchema>;

export const FOOD_REF_SORT_FIELDS = ['name', 'kcal', 'fat', 'carb', 'protein'] as const;

export const FoodRefListQuerySchema = z
  .object({
    q: z.string().trim().max(255).optional(),
    /** A level-1 food-group label, as returned by `GET /food-refs/groups`. */
    group: z.string().trim().max(255).optional(),
    locale: CatalogLocaleSchema.optional().default('fr'),
    sort: z.enum(FOOD_REF_SORT_FIELDS).optional().default('name'),
    dir: z.enum(['asc', 'desc']).optional().default('asc'),
    limit: z.coerce.number().int().positive().max(200).optional().default(50),
    cursor: z.string().optional(),
    offset: offsetField,
  })
  .superRefine(rejectCursorWithOffset);
export type FoodRefListQuery = z.infer<typeof FoodRefListQuerySchema>;

export const FoodRefGroupsQuerySchema = z.object({
  locale: CatalogLocaleSchema.optional().default('fr'),
});
export type FoodRefGroupsQuery = z.infer<typeof FoodRefGroupsQuerySchema>;

/** List response envelope (spec/api/00-conventions.md §List behaviour). */
export interface FoodRefListResponse {
  data: FoodRef[];
  next_cursor: string | null;
  /** Entries matching the query's filters, independent of `limit`/`cursor` (B-278 convention). */
  total: number;
}

export interface FoodRefGroupsResponse {
  data: string[];
}

/**
 * Adopt a reference entry into a real food (`POST /foods/from-ref`, B-293). What the search
 * pickers call when the user picks a Ciqual entry — the Aliments catalog instead prefills the
 * food form, so the user can rename before saving (B-292). Idempotent server-side.
 */
export const AdoptFoodRefSchema = z.object({
  ref_id: z.string().uuid(),
  /** Which language the adopted food is named in (D6). */
  locale: CatalogLocaleSchema.optional().default('fr'),
});
export type AdoptFoodRefRequest = z.infer<typeof AdoptFoodRefSchema>;
