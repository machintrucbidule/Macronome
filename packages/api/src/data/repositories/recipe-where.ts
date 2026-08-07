import type { Prisma } from '@prisma/client';
import type { RecipeIdsQuery, RecipeListQuery } from '@macronome/shared';

// The Recettes filter predicate, in one place — the twin of `food-where.ts`, extracted by BE-1 for
// the same reason: the bulk "select everything matching the current filter" endpoint must resolve
// exactly the set the list is showing.

/** `q.normalized` is the pre-normalized search term, injected by the service. */
export type RecipeFilterQuery = (RecipeListQuery | RecipeIdsQuery) & { normalized?: string };

export function buildRecipeWhere(userId: string, q: RecipeFilterQuery): Prisma.RecipeWhereInput {
  const where: Prisma.RecipeWhereInput = { ownerId: userId };
  if (!q.include_archived) where.archivedAt = null;
  if (q.normalized) where.normalizedName = { contains: q.normalized };
  if (q.min_rating) where.rating = { gte: q.min_rating }; // excludes Bof(0) and unrated(null)
  return where;
}
