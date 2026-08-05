/**
 * How long an accumulated infinite list stays in the query cache after its screen unmounts
 * (B-268). Long enough that stepping into a food/recipe and coming back keeps every page the user
 * scrolled through — otherwise only page 1 is remounted, the document is shorter than the saved
 * scroll offset, and the browser clamps the restore near the top.
 *
 * Session-scoped by nature: the cache is in memory, so this never survives a reload. The owner
 * declined persisting list state across sessions.
 */
export const LIST_GC_TIME = 30 * 60 * 1000;
