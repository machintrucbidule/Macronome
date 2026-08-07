import type {
  BulkIdsResponse,
  BulkUndoResponse,
  BulkUpdateResponse,
  FoodBulkUpdateRequest,
  FoodIdsQuery,
} from '@macronome/shared';
import { foodBulkRepo, type FoodBulkSnapshot } from '../data/repositories/food-bulk.repo.js';
import { normalize } from '../domain/search/normalize.js';
import { rememberBulk, takeBulk } from './bulk-undo.js';

// Bulk edit of the Aliments catalog (BE-1). Orchestration only: normalize the search key like the
// list service does, hand the repository the ids, and park what was overwritten in the undo slot.

const RESOURCE = 'foods' as const;

/** `GET /foods/ids` — the ids matching the filter, unpaginated (the frozen set of D10). */
export async function ids(userId: string, query: FoodIdsQuery): Promise<BulkIdsResponse> {
  const opts = query.q ? { ...query, normalized: normalize(query.q) } : query;
  return { data: await foodBulkRepo.idsMatching(userId, opts) };
}

/** `PATCH /foods/bulk` — all or nothing. `null` ⇒ an id was not the user's: 404, nothing written. */
export async function bulkUpdate(
  userId: string,
  body: FoodBulkUpdateRequest,
): Promise<BulkUpdateResponse | null> {
  const before = await foodBulkRepo.patchMany(userId, body.ids, body.patch);
  if (before === null) return null;
  rememberBulk(userId, RESOURCE, before);
  return { updated: before.length };
}

/** `POST /foods/bulk/undo` — single-level: `null` ⇒ 409 `nothing_to_undo`. */
export async function bulkUndo(userId: string): Promise<BulkUndoResponse | null> {
  const rows = takeBulk<FoodBulkSnapshot>(userId, RESOURCE);
  if (rows === null) return null;
  return { restored: await foodBulkRepo.restore(userId, rows) };
}
