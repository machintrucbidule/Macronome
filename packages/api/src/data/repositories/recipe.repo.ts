import type {
  Recipe as RecipeModel,
  RecipeIngredient as RecipeIngredientModel,
  Prisma,
} from '@prisma/client';
import type { RecipeListQuery } from '@macronome/shared';
import { prisma } from '../prisma.js';
import { pageStartIndex, pageWindow } from './page-window.js';
import { recipeDerivedFoodRepo, type DerivedSummary } from './recipe-derived-food.repo.js';
import { isRankedSort, rankRecipes, type RankedRecipeSort } from './recipe-rank.js';
import { buildRecipeWhere } from './recipe-where.js';

// Repository for recipe + recipe_ingredient. Every method is scoped by the authenticated
// `userId` (CLAUDE.md rule 3); a cross-tenant id resolves to null → 404 at the controller.
// No business logic here — the service aggregates macros, runs the cycle guard, and builds
// the derived food. Ingredients are read/written explicitly (no Prisma relation). The
// derived food is persisted by recipe-derived-food.repo.ts.

export type RecipeWithIngredients = RecipeModel & { ingredients: RecipeIngredientModel[] };

export interface IngredientWriteData {
  refType: string;
  refFoodId: string | null;
  refRecipeId: string | null;
  quantity: number;
  unit: string;
  portionId: string | null;
  orderIndex: number;
}

export interface RecipeWriteData {
  name: string;
  normalizedName: string;
  instructions: string | null;
  rating: number | null;
  totalBatchGrams: number;
  /** RW-1: true ⇒ totalBatchGrams is server-kept = Σ ingredient grams. */
  batchWeightAuto: boolean;
  servings: number;
  ingredients: IngredientWriteData[];
}

/** Map the `sort` query field to its column. The ranked sorts (RS-1/B-306) have none — excluding
 *  them here makes a missing mapping a compile error rather than a silent `undefined` orderBy,
 *  the shape `food.repo` already uses for `usage`. */
const SORT_COLUMN: Record<Exclude<RecipeListQuery['sort'], RankedRecipeSort>, keyof RecipeModel> = {
  name: 'name',
  batch: 'totalBatchGrams',
  servings: 'servings',
  rating: 'rating',
};

/** Unrated recipes sink to the bottom whichever way Note is sorted — same rule, same reason as
 *  `food.repo` (B-299 follow-up): Postgres defaults to NULLS FIRST on DESC, so "Note ↓" opened on
 *  the « Pas noté » rows. `rating` is the only nullable sortable column here. */
function orderFor(column: keyof RecipeModel, dir: 'asc' | 'desc') {
  return column === 'rating' ? { sort: dir, nulls: 'last' as const } : dir;
}

type ListQuery = RecipeListQuery & { normalized?: string };

async function ingredientsByRecipeIds(
  ids: string[],
): Promise<Map<string, RecipeIngredientModel[]>> {
  const byRecipe = new Map<string, RecipeIngredientModel[]>();
  if (ids.length === 0) return byRecipe;
  const rows = await prisma.recipeIngredient.findMany({
    where: { recipeId: { in: ids } },
    orderBy: [{ orderIndex: 'asc' }],
  });
  for (const row of rows) {
    const list = byRecipe.get(row.recipeId);
    if (list) list.push(row);
    else byRecipe.set(row.recipeId, [row]);
  }
  return byRecipe;
}

function toIngredientCreate(recipeId: string, data: IngredientWriteData[]) {
  return data.map((ing) => ({
    recipeId,
    refType: ing.refType,
    refFoodId: ing.refFoodId,
    refRecipeId: ing.refRecipeId,
    quantity: ing.quantity,
    unit: ing.unit,
    portionId: ing.portionId,
    orderIndex: ing.orderIndex,
  }));
}

/** A page of the list, plus the derived-food summaries of the rows on it. The summaries are read
 *  HERE rather than in the service (RS-1/B-306): the ranked path orders on figures that live on
 *  the derived food, so it cannot wait for the service to fetch them after pagination. */
export interface RecipeListPage {
  rows: RecipeModel[];
  derived: Map<string, DerivedSummary>;
  nextCursor: string | null;
  total: number;
}

/** Ranked sorts (RS-1/B-306): no column to order by, so materialise the match set, read every
 *  matched recipe's derived summary, rank, and paginate by slicing the deterministic order —
 *  `food.repo.listByUsage`'s shape, and sound for the same reason: the match set is a single
 *  user's bounded catalog. Never keyset, so `offset` is simply where the slice starts. */
async function listRanked(
  userId: string,
  query: ListQuery,
  sort: RankedRecipeSort,
): Promise<RecipeListPage> {
  const matches = await prisma.recipe.findMany({ where: buildRecipeWhere(userId, query) });
  const derived = await recipeDerivedFoodRepo.derivedSummariesByRecipeIds(
    userId,
    matches.map((r) => r.id),
  );
  const ranked = rankRecipes(matches, derived, sort, query.dir);
  const begin = pageStartIndex(query, () => ranked.findIndex((r) => r.id === query.cursor));
  const rows = ranked.slice(begin, begin + query.limit);
  const nextCursor = begin + query.limit < ranked.length ? (rows.at(-1)?.id ?? null) : null;
  // Free here: this path already materialises every match to rank it.
  return { rows, derived, nextCursor, total: ranked.length };
}

export const recipeRepo = {
  async list(userId: string, query: ListQuery): Promise<RecipeListPage> {
    if (isRankedSort(query.sort)) return listRanked(userId, query, query.sort);
    const column = SORT_COLUMN[query.sort];
    const orderBy: Prisma.RecipeOrderByWithRelationInput[] = [
      { [column]: orderFor(column, query.dir) },
      { id: query.dir },
    ];
    const where = buildRecipeWhere(userId, query);
    // B-278: the same predicate, counted — how many rows match regardless of limit/cursor. The
    // client reserves the height of the rows not yet loaded and shows the figure in the toolbar.
    const [rows, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        orderBy,
        take: query.limit + 1,
        ...pageWindow(query),
      }),
      prisma.recipe.count({ where }),
    ]);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;
    const derived = await recipeDerivedFoodRepo.derivedSummariesByRecipeIds(
      userId,
      page.map((r) => r.id),
    );
    return { rows: page, derived, nextCursor, total };
  },

  async findById(userId: string, id: string): Promise<RecipeWithIngredients | null> {
    const recipe = await prisma.recipe.findFirst({ where: { id, ownerId: userId } });
    if (!recipe) return null;
    const ingredients = (await ingredientsByRecipeIds([id])).get(id) ?? [];
    return { ...recipe, ingredients };
  },

  async existsActiveByNormalizedName(
    userId: string,
    normalizedName: string,
    excludeId?: string,
  ): Promise<boolean> {
    const match = await prisma.recipe.findFirst({
      where: {
        ownerId: userId,
        normalizedName,
        archivedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return match !== null;
  },

  /** Insert a recipe + its ingredients in one transaction. Returns the new recipe id. */
  async create(userId: string, data: RecipeWriteData): Promise<string> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.recipe.create({
        data: {
          ownerId: userId,
          name: data.name,
          normalizedName: data.normalizedName,
          instructions: data.instructions,
          rating: data.rating,
          totalBatchGrams: data.totalBatchGrams,
          batchWeightAuto: data.batchWeightAuto,
          servings: data.servings,
        },
      });
      if (data.ingredients.length > 0) {
        await tx.recipeIngredient.createMany({
          data: toIngredientCreate(created.id, data.ingredients),
        });
      }
      return created.id;
    });
  },

  /** Patch a recipe (and replace its ingredients). Returns false if not owned. */
  async update(userId: string, id: string, data: RecipeWriteData): Promise<boolean> {
    const owned = await prisma.recipe.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!owned) return false;
    await prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id },
        data: {
          name: data.name,
          normalizedName: data.normalizedName,
          instructions: data.instructions,
          rating: data.rating,
          totalBatchGrams: data.totalBatchGrams,
          batchWeightAuto: data.batchWeightAuto,
          servings: data.servings,
        },
      });
      await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      if (data.ingredients.length > 0) {
        await tx.recipeIngredient.createMany({ data: toIngredientCreate(id, data.ingredients) });
      }
    });
    return true;
  },

  /** RW-1: refresh an auto recipe's batch weight to the current Σ during a rebuild. */
  async setBatchGrams(userId: string, id: string, grams: number): Promise<void> {
    await prisma.recipe.updateMany({
      where: { id, ownerId: userId },
      data: { totalBatchGrams: grams },
    });
  },

  async setArchived(userId: string, id: string, archived: boolean): Promise<boolean> {
    const result = await prisma.recipe.updateMany({
      where: { id, ownerId: userId },
      data: { archivedAt: archived ? new Date() : null },
    });
    return result.count > 0;
  },

  /** All recipe→recipe ingredient edges for this user (for the cycle guard + cascade). */
  async recipeEdges(userId: string): Promise<{ recipeId: string; refRecipeId: string }[]> {
    const rows = await prisma.recipeIngredient.findMany({
      where: { refType: 'recipe', refRecipeId: { not: null } },
      select: { recipeId: true, refRecipeId: true },
    });
    // Scope to the user's recipes (ingredients carry no owner; join through recipe ids).
    const ownIds = new Set(
      (await prisma.recipe.findMany({ where: { ownerId: userId }, select: { id: true } })).map(
        (r) => r.id,
      ),
    );
    return rows
      .filter((r) => r.refRecipeId !== null && ownIds.has(r.recipeId))
      .map((r) => ({ recipeId: r.recipeId, refRecipeId: r.refRecipeId as string }));
  },
};
