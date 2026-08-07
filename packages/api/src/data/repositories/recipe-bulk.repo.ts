import type { Prisma } from '@prisma/client';
import type { RecipeBulkPatch } from '@macronome/shared';
import { prisma } from '../prisma.js';
import { buildRecipeWhere, type RecipeFilterQuery } from './recipe-where.js';

// Bulk edit of the Recettes list (BE-1/B-308) — the twin of `food-bulk.repo.ts`, restricted to the
// rating. `servings` and `total_batch_grams` are deliberately not bulk-editable: they rebuild the
// recipe's derived food, so a batch write would move the per-portion and per-100 g figures of every
// recipe touched (spec/api/foods-recipes.md §Recipes).

/** The one bulk-editable column, as it was before the batch — the undo payload. */
export interface RecipeBulkSnapshot {
  id: string;
  rating: number | null;
}

/** Tenant scope, applied to EVERY bulk read and write — the ids come from the client. */
const owned = (userId: string, ids: string[]): Prisma.RecipeWhereInput => ({
  id: { in: ids },
  ownerId: userId,
});

export const recipeBulkRepo = {
  /** Every id matching the filter, unpaginated — the frozen set behind the header checkbox (D10). */
  async idsMatching(userId: string, query: RecipeFilterQuery): Promise<string[]> {
    const rows = await prisma.recipe.findMany({
      where: buildRecipeWhere(userId, query),
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  /** Apply `patch` to every id in one transaction; `null` when an id is not the user's (404,
   *  nothing written — the mismatch aborts the same transaction the snapshot was read in). */
  async patchMany(
    userId: string,
    ids: string[],
    patch: RecipeBulkPatch,
  ): Promise<RecipeBulkSnapshot[] | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        const before = await tx.recipe.findMany({
          where: owned(userId, ids),
          select: { id: true, rating: true },
        });
        if (before.length !== new Set(ids).size) throw new NotAllOwned();
        await tx.recipe.updateMany({
          where: owned(userId, ids),
          data: { ...(patch.rating !== undefined ? { rating: patch.rating } : {}) },
        });
        return before;
      });
    } catch (err) {
      if (err instanceof NotAllOwned) return null;
      throw err;
    }
  },

  /** Put the snapshot back, row by row. */
  async restore(userId: string, rows: RecipeBulkSnapshot[]): Promise<number> {
    return prisma.$transaction(async (tx) => {
      let restored = 0;
      for (const row of rows) {
        const res = await tx.recipe.updateMany({
          where: owned(userId, [row.id]),
          data: { rating: row.rating },
        });
        restored += res.count;
      }
      return restored;
    });
  },
};

/** Aborts the transaction when an id is not the user's, so the snapshot read rolls back too. */
class NotAllOwned extends Error {}
