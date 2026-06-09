import type {
  Recipe as RecipeModel,
  RecipeIngredient as RecipeIngredientModel,
  Prisma,
} from '@prisma/client';
import type { RecipeListQuery } from '@macronome/shared';
import { prisma } from '../prisma.js';

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

const SORT_COLUMN: Record<RecipeListQuery['sort'], keyof RecipeModel> = {
  name: 'name',
  batch: 'totalBatchGrams',
  servings: 'servings',
  rating: 'rating',
};

type ListQuery = RecipeListQuery & { normalized?: string };

function buildWhere(userId: string, q: ListQuery): Prisma.RecipeWhereInput {
  const where: Prisma.RecipeWhereInput = { ownerId: userId };
  if (!q.include_archived) where.archivedAt = null;
  if (q.normalized) where.normalizedName = { contains: q.normalized };
  if (q.min_rating) where.rating = { gte: q.min_rating }; // excludes Bof(0) and unrated(null)
  return where;
}

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

export const recipeRepo = {
  async list(
    userId: string,
    query: ListQuery,
  ): Promise<{ rows: RecipeModel[]; nextCursor: string | null }> {
    const column = SORT_COLUMN[query.sort];
    const orderBy: Prisma.RecipeOrderByWithRelationInput[] = [
      { [column]: query.dir },
      { id: query.dir },
    ];
    const rows = await prisma.recipe.findMany({
      where: buildWhere(userId, query),
      orderBy,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? (page.at(-1)?.id ?? null) : null;
    return { rows: page, nextCursor };
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
