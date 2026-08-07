import type { Recipe as RecipeModel } from '@prisma/client';
import type { RecipeListQuery } from '@macronome/shared';
import type { DerivedSummary } from './recipe-derived-food.repo.js';

// Ranking for the Recettes sorts that have no stored column (RS-1/B-306). Four of them read the
// per-100 g macros of the recipe's **derived food** — a different table, reachable by no Prisma
// relation — and `weight_per_portion` is an expression over two real recipe columns. Neither can
// reach an `ORDER BY`, so the repository materialises the match set and orders it here, exactly as
// `food-usage.ts` does for the Aliments «Utilisation» column.

/** The sorts ranked in memory; everything else maps to a column. */
export const RANKED_RECIPE_SORTS = [
  'kcal',
  'fat',
  'carb',
  'protein',
  'weight_per_portion',
] as const;

export type RankedRecipeSort = (typeof RANKED_RECIPE_SORTS)[number];

const RANKED = new Set<string>(RANKED_RECIPE_SORTS);

export function isRankedSort(sort: RecipeListQuery['sort']): sort is RankedRecipeSort {
  return RANKED.has(sort);
}

const num = (d: { toString(): string }): number => Number(d.toString());
const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The figure the column shows. A recipe with no derived food row reads 0 — the same 0 the table
 *  displays, and an ordinary value to order on: burying a genuinely zero-calorie recipe would hide
 *  a real measurement, so NULLS-LAST stays scoped to `rating` (RS-1/B-306, superseding D26). */
function valueOf(
  recipe: RecipeModel,
  derived: DerivedSummary | undefined,
  sort: RankedRecipeSort,
): number {
  if (sort === 'weight_per_portion') return num(recipe.totalBatchGrams) / recipe.servings;
  return derived?.per100g[sort] ?? 0;
}

/**
 * Order the whole match set by a ranked column, most-first for `dir=desc`.
 *
 * `dir` flips the **value axis only** — name then id stay ascending — so the result is a total
 * order that is identical across paginated calls. That is not cosmetic: both `cursor` and `offset`
 * paginate by slicing this array, and an unstable order would duplicate and drop rows between
 * pages (`food-usage.ts` keeps the same invariant for the same reason).
 */
export function rankRecipes(
  recipes: RecipeModel[],
  derived: Map<string, DerivedSummary>,
  sort: RankedRecipeSort,
  dir: 'asc' | 'desc',
): RecipeModel[] {
  const sign = dir === 'asc' ? -1 : 1;
  return [...recipes].sort((a, b) => {
    const va = valueOf(a, derived.get(a.id), sort);
    const vb = valueOf(b, derived.get(b.id), sort);
    if (va !== vb) return (vb - va) * sign;
    return a.name.localeCompare(b.name) || cmpStr(a.id, b.id);
  });
}
