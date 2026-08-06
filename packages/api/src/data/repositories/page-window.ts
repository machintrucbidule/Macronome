/**
 * Where a list page starts, as Prisma arguments (spec/api/00-conventions.md §List behaviour).
 *
 * Two mutually exclusive ways, shared by the three paginated lists so they cannot drift:
 *  - **`offset`** — the jump path (LD-1/B-303). A client that drops its scrollbar into the middle
 *    of a 3 400-row catalog cannot name the row it landed on, so a cursor is no use to it.
 *  - **`cursor`** — the sequential path. The id is the previous page's last row, hence the extra
 *    `skip: 1` that excludes the cursor row itself.
 *
 * The DTO rejects both together (`rejectCursorWithOffset`), so the precedence below is only a
 * belt-and-braces ordering, never a silent rule the caller could rely on.
 */
export interface PageStart {
  limit: number;
  cursor?: string | undefined;
  offset?: number | undefined;
}

export function pageWindow(q: PageStart): { skip?: number; cursor?: { id: string } } {
  if (q.offset !== undefined) return { skip: q.offset };
  if (q.cursor) return { cursor: { id: q.cursor }, skip: 1 };
  return {};
}

/** Row index a page starts at, for the paths that slice in memory rather than in SQL. */
export function pageStartIndex(q: PageStart, indexOfCursor: () => number): number {
  if (q.offset !== undefined) return q.offset;
  const after = q.cursor ? indexOfCursor() : -1;
  return after >= 0 ? after + 1 : 0;
}
