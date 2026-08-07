import type {
  BulkIdsResponse,
  BulkUndoResponse,
  BulkUpdateResponse,
  RecipeBulkUpdateRequest,
  RecipeIdsQuery,
} from '@macronome/shared';
import { recipeBulkRepo, type RecipeBulkSnapshot } from '../data/repositories/recipe-bulk.repo.js';
import { normalize } from '../domain/search/normalize.js';
import { rememberBulk, takeBulk } from './bulk-undo.js';

// Bulk edit of the Recettes list (BE-1/B-308) — the twin of `foods-bulk.ts`, rating only.

const RESOURCE = 'recipes' as const;

/** `GET /recipes/ids` — the ids matching the filter, unpaginated (the frozen set of D10). */
export async function ids(userId: string, query: RecipeIdsQuery): Promise<BulkIdsResponse> {
  const opts = query.q ? { ...query, normalized: normalize(query.q) } : query;
  return { data: await recipeBulkRepo.idsMatching(userId, opts) };
}

/** `PATCH /recipes/bulk` — all or nothing. `null` ⇒ an id was not the user's: 404, nothing written. */
export async function bulkUpdate(
  userId: string,
  body: RecipeBulkUpdateRequest,
): Promise<BulkUpdateResponse | null> {
  const before = await recipeBulkRepo.patchMany(userId, body.ids, body.patch);
  if (before === null) return null;
  rememberBulk(userId, RESOURCE, before);
  return { updated: before.length };
}

/** `POST /recipes/bulk/undo` — single-level: `null` ⇒ 409 `nothing_to_undo`. */
export async function bulkUndo(userId: string): Promise<BulkUndoResponse | null> {
  const rows = takeBulk<RecipeBulkSnapshot>(userId, RESOURCE);
  if (rows === null) return null;
  return { restored: await recipeBulkRepo.restore(userId, rows) };
}
