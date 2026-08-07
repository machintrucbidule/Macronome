import type { Prisma } from '@prisma/client';
import type { FoodIdsQuery, FoodListQuery } from '@macronome/shared';

// The Aliments filter predicate, in one place. Extracted from `food.repo.ts` by BE-1: the bulk
// "select everything matching the current filter" endpoint must resolve **exactly** the set the
// list is showing, and two copies of this would drift the day a filter is added.

/** Recipe-derived foods (source='recipe') live on the Recettes screen and the combined
 *  /search/loggable, never in the Aliments catalog (spec/api §Foods). */
export const BROWSABLE: Prisma.StringFilter<'Food'> = { not: 'recipe' };

/** Matches the render condition exactly (`FoodRow`: `{food.comment && …}`) — an empty string is
 *  storable (`comment: body.comment ?? null`, no trim in the DTO) and draws no sub-line, so
 *  `IS NOT NULL` alone would over-count. `NOT [a, b]` is "neither a nor b" in Prisma. */
export const HAS_COMMENT: Prisma.FoodWhereInput = { NOT: [{ comment: null }, { comment: '' }] };

/** `q.normalized` is the pre-normalized search term, injected by the service. */
export type FoodFilterQuery = (FoodListQuery | FoodIdsQuery) & { normalized?: string };

export function buildFoodWhere(userId: string, q: FoodFilterQuery): Prisma.FoodWhereInput {
  const where: Prisma.FoodWhereInput = { ownerId: userId, source: BROWSABLE };
  if (!q.include_archived) where.archivedAt = null;
  if (q.visibility) where.visibility = q.visibility;
  // Overwrites the BROWSABLE guard on the SAME key — safe only because the accepted filter
  // vocabulary (manual|ciqual|chronodrive, FoodListQuerySchema) can never be 'recipe'. Widen
  // that enum and this silently starts exposing recipe-derived foods: compose, don't replace.
  if (q.source) where.source = q.source;
  if (q.min_rating) where.rating = { gte: q.min_rating }; // excludes Bof(0) and unrated(null)
  if (q.normalized) where.normalizedName = { contains: q.normalized };
  return where;
}
