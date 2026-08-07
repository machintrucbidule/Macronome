import type { Prisma } from '@prisma/client';
import type { FoodBulkPatch } from '@macronome/shared';
import { prisma } from '../prisma.js';
import { BROWSABLE, buildFoodWhere, type FoodFilterQuery } from './food-where.js';

// Bulk edit of the Aliments catalog (BE-1, spec/api/00-conventions.md §Bulk writes). Kept out of
// `food.repo.ts`, which is already near the file-size cap, and separate because its rules are its
// own: all-or-nothing, and every id re-scoped to the authenticated user before it can write.

/** The five bulk-editable columns of one food, as they were before the batch — the undo payload. */
export interface FoodBulkSnapshot {
  id: string;
  rating: number | null;
  source: string;
  visibility: string;
  aiProposable: boolean;
  comment: string | null;
}

const SNAPSHOT_SELECT = {
  id: true,
  rating: true,
  source: true,
  visibility: true,
  aiProposable: true,
  comment: true,
} as const;

/** Absent = leave unchanged; `comment: null` = clear; `rating: null` = « Pas noté ». The same
 *  semantics as the single-row PATCH, expressed once. */
function patchColumns(patch: FoodBulkPatch): Prisma.FoodUpdateManyMutationInput {
  return {
    ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
    ...(patch.source !== undefined ? { source: patch.source } : {}),
    ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
    ...(patch.ai_proposable !== undefined ? { aiProposable: patch.ai_proposable } : {}),
    ...(patch.comment !== undefined ? { comment: patch.comment } : {}),
  };
}

/** Tenant scope, applied to EVERY bulk read and write. The ids come from the client and are never
 *  trusted (CLAUDE.md rule 3); recipe-derived rows are excluded like everywhere else. */
const owned = (userId: string, ids: string[]): Prisma.FoodWhereInput => ({
  id: { in: ids },
  ownerId: userId,
  source: BROWSABLE,
});

export const foodBulkRepo = {
  /** Every id matching the filter, unpaginated — the frozen set behind the header checkbox (D10).
   *  Reuses the list's own predicate, so "everything matching" cannot drift from what is shown. */
  async idsMatching(userId: string, query: FoodFilterQuery): Promise<string[]> {
    const rows = await prisma.food.findMany({
      where: buildFoodWhere(userId, query),
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  /**
   * Apply `patch` to every id, in one transaction, and return the values it overwrote.
   *
   * Returns `null` when any id is not the user's — the caller answers 404 and **nothing is
   * written**, because the snapshot is taken and the update runs inside the same transaction that
   * the mismatch aborts.
   */
  async patchMany(
    userId: string,
    ids: string[],
    patch: FoodBulkPatch,
  ): Promise<FoodBulkSnapshot[] | null> {
    try {
      return await prisma.$transaction(async (tx) => {
        const before = await tx.food.findMany({
          where: owned(userId, ids),
          select: SNAPSHOT_SELECT,
        });
        // A short read is either a cross-tenant id or a deleted one; both mean "not the user's".
        if (before.length !== new Set(ids).size) throw new NotAllOwned();
        await tx.food.updateMany({ where: owned(userId, ids), data: patchColumns(patch) });
        return before;
      });
    } catch (err) {
      if (err instanceof NotAllOwned) return null;
      throw err;
    }
  },

  /** Put the snapshot back, row by row (each row had its own previous values). */
  async restore(userId: string, rows: FoodBulkSnapshot[]): Promise<number> {
    return prisma.$transaction(async (tx) => {
      let restored = 0;
      for (const row of rows) {
        const res = await tx.food.updateMany({
          where: owned(userId, [row.id]),
          data: {
            rating: row.rating,
            source: row.source,
            visibility: row.visibility,
            aiProposable: row.aiProposable,
            comment: row.comment,
          },
        });
        restored += res.count;
      }
      return restored;
    });
  },
};

/** Aborts the transaction when an id is not the user's, so the snapshot read rolls back too. */
class NotAllOwned extends Error {}
