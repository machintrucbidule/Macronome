import { z } from 'zod';

// The two ways a paginated list says where a page starts (spec/api/00-conventions.md §List
// behaviour). Shared by foods, the Ciqual catalog and recipes so the three can never drift on it.
//
// `cursor` is a row id — it can only ever mean "the page after this row", which is cheap to walk
// but useless to a client that dropped its scrollbar into the middle of a 3 400-row catalog: it
// cannot name the row it landed on, so it had to walk every page to get there (LD-1/B-303).
// `offset` is that client's entry point. They express two different start positions for one
// request, so sending both is a validation error rather than a silent precedence rule.

/** Row index the page starts at. `offset = k·limit` is the page a cursor walk reaches after k steps. */
export const offsetField = z.coerce.number().int().nonnegative().optional();

/** Reject `cursor` + `offset` together. Apply with `.superRefine(rejectCursorWithOffset)`. */
export function rejectCursorWithOffset(
  value: { cursor?: string | undefined; offset?: number | undefined },
  ctx: z.RefinementCtx,
): void {
  if (value.cursor !== undefined && value.offset !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cursor_and_offset',
      path: ['offset'],
    });
  }
}
