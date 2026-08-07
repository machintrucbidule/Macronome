// Undo slot for a bulk write (BE-1, spec/api/00-conventions.md §Bulk writes).
//
// The day undo (B-261) keeps its restore point in a table; the owner asked for this one to be
// server-side, transient, with **no new table** (D12) — so it lives in memory: ONE slot per user
// and per resource, overwritten by the next batch, consumed on success, gone on restart.
//
// Losing it on restart is deliberate, not a shortcut: the toast carrying « Annuler » is the only
// door to this undo (design/components/toasts-warnings.md §E), and that toast does not survive a
// restart either. There is deliberately no timer — the day restore points do not expire, and a
// timer would only add a way for the button to fail while it is still on screen.

export type BulkResource = 'foods' | 'recipes';

const slots = new Map<string, unknown>();

const key = (userId: string, resource: BulkResource): string => `${resource}:${userId}`;

/** Record what a batch overwrote, replacing whatever this user's previous batch left. */
export function rememberBulk<T>(userId: string, resource: BulkResource, rows: T[]): void {
  slots.set(key(userId, resource), rows);
}

/** Take the snapshot, leaving the slot empty — undo is single-level, so a second call gets null. */
export function takeBulk<T>(userId: string, resource: BulkResource): T[] | null {
  const k = key(userId, resource);
  const rows = slots.get(k) as T[] | undefined;
  if (rows === undefined) return null;
  slots.delete(k);
  return rows;
}

/** Test seam: drop every slot. Not reachable from the API. */
export function clearBulkUndo(): void {
  slots.clear();
}
