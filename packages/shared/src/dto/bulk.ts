import { z } from 'zod';

// One request editing SEVERAL INDEPENDENT rows of one resource (spec/api/00-conventions.md
// §Bulk writes, BE-1). Distinct from the multi-id bodies that already existed — a reorder, a
// leftover selection — which act on one parent row.
//
// Shared by foods and recipes so the two can never drift on the envelope, the ceiling or the
// "the patch must change something" guard.

/** Ids accepted in one bulk write. Far above any personal catalogue: it exists so a malformed
 *  client cannot hand the server an unbounded list, not to limit a real selection. */
export const BULK_MAX_IDS = 5000;

export const BulkIdsSchema = z.array(z.string().uuid()).min(1).max(BULK_MAX_IDS);

/** `.superRefine(rejectEmptyPatch)` — a patch whose every field is absent changes nothing, and
 *  saying so beats writing a no-op batch the user could then "undo". */
export function rejectEmptyPatch(value: object, ctx: z.RefinementCtx): void {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'empty_patch', path: ['patch'] });
  }
}

/** `GET /<resource>/ids` — the ids matching a filter, unpaginated and unordered. */
export interface BulkIdsResponse {
  data: string[];
}

/** `PATCH /<resource>/bulk` — all or nothing, so a plain count and no per-row error list. */
export interface BulkUpdateResponse {
  updated: number;
}

/** `POST /<resource>/bulk/undo` — single-level; 409 `nothing_to_undo` once consumed. */
export interface BulkUndoResponse {
  restored: number;
}
