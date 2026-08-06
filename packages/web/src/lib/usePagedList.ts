import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { LIST_GC_TIME } from './listCache';

/**
 * A long list held as a **map of pages keyed by page index** (LD-1/B-303), replacing the cursor
 * chain that Aliments, the Ciqual catalog and Recettes used.
 *
 * Why the chain had to go: a cursor is a row id, so page N could not be asked for without page
 * N−1's answer. Dropping the scrollbar to the end of the 3 400-row catalog therefore meant ~68
 * round trips **in series** before the rows under the thumb appeared. Here the page at the scroll
 * position is requested first, and the interval behind it is backfilled afterwards (D18), a few
 * requests at a time.
 *
 * Nothing is ever evicted (D17): a loaded page stays in the query cache for `LIST_GC_TIME`, so
 * scrolling back never refetches and the B-268 scroll restore still finds a full-height document.
 */
export const PAGE_SIZE = 50;

/** Page requests allowed in flight at once while backfilling. The browser allows ~6 per origin;
 *  the headroom keeps the user's own jump ahead of the queue running behind it. */
const FILL_CONCURRENCY = 4;

/** One entry of the rendered list: a real row, a loading placeholder, or reserved empty height. */
export type Slot<T> =
  | { kind: 'row'; item: T }
  | { kind: 'skeleton' }
  | { kind: 'gap'; rows: number };

export interface PagedPage<T> {
  data: T[];
  total: number;
}

export interface PagedList<T> {
  /** The whole result set in order — loaded rows, placeholders and reserved gaps (D29). */
  slots: Slot<T>[];
  /** The loaded rows only, in order, for callers that need the flat list. */
  rows: T[];
  total: number | undefined;
  /** Nothing has answered yet — the screen shows its own full-list skeleton. */
  loading: boolean;
  isError: boolean;
  /** Rows in the measured container (page 0's), the pitch reference. */
  firstPageCount: number;
  /** Ask for the page holding this absolute row index, then queue the interval behind it. */
  requestRow: (rowIndex: number) => void;
}

interface Options<T> {
  /** Query key prefix; the page index is appended. Must already carry the filters. */
  queryKey: readonly unknown[];
  fetchPage: (offset: number, limit: number) => Promise<PagedPage<T>>;
  enabled?: boolean;
}

const merge = (prev: number[], add: number[]): number[] =>
  [...new Set([...prev, ...add])].sort((a, b) => a - b);

/** Missing indices in `[0, target]`, nearest to `target` first — the order a backfill runs in. */
function backlogFor(target: number, have: Set<number>): number[] {
  const missing: number[] = [];
  for (let i = 0; i <= target; i += 1) if (!have.has(i)) missing.push(i);
  return missing.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
}

export function usePagedList<T>(opts: Options<T>): PagedList<T> {
  const { queryKey, fetchPage, enabled = true } = opts;
  // Mounted page queries. Grow-only within a filter set: dropping one would refetch it on the way
  // back up, which D17 forbids. A changed `queryKey` remounts the hook's consumer state anyway.
  const [wanted, setWanted] = useState<number[]>([0]);
  const [queue, setQueue] = useState<number[]>([]);

  const results = useQueries({
    queries: wanted.map((index) => ({
      queryKey: [...queryKey, index],
      queryFn: () => fetchPage(index * PAGE_SIZE, PAGE_SIZE),
      gcTime: LIST_GC_TIME,
      enabled,
    })),
  });

  const byIndex = new Map<number, T[]>();
  let total: number | undefined;
  let isError = false;
  let inFlight = 0;
  const stamps: string[] = [];
  wanted.forEach((index, i) => {
    const r = results[i];
    if (!r) return;
    if (r.isError) isError = true;
    if (r.isPending) inFlight += 1;
    if (r.data) {
      byIndex.set(index, r.data.data);
      // Every page reports the same figure (D30), so whichever answered first is authoritative —
      // after a jump that is routinely not page 0.
      total ??= r.data.total;
      // The fetch stamp, not just the index: a mutation invalidates the list and page 0 comes back
      // with different rows under the same index. Keying the memos on the index alone left the
      // freshly-added food invisible while the toolbar already counted it.
      stamps.push(`${index}:${r.dataUpdatedAt}`);
    }
  });
  const loadedKey = stamps.join(',');

  // Release the next slice of the backlog as requests settle.
  useEffect(() => {
    if (queue.length === 0 || inFlight >= FILL_CONCURRENCY) return;
    const take = queue.slice(0, FILL_CONCURRENCY - inFlight);
    setWanted((prev) => merge(prev, take));
    setQueue((prev) => prev.slice(take.length));
  }, [queue, inFlight]);

  const requestRow = (rowIndex: number): void => {
    const target = Math.max(0, Math.floor(rowIndex / PAGE_SIZE));
    const have = new Set([...byIndex.keys(), ...wanted]);
    // The page under the thumb goes straight in; everything behind it queues (D18). A new jump
    // replaces the queue outright — that is what cancels a superseded backfill.
    if (!have.has(target)) {
      setWanted((prev) => merge(prev, [target]));
      have.add(target);
    }
    const rest = backlogFor(target, have);
    setQueue((prev) => (prev.join(',') === rest.join(',') ? prev : rest));
  };

  const nextInQueue = queue[0];
  const wantedKey = wanted.join(',');
  const slots = useMemo(
    () => buildSlots(byIndex, total, wanted, nextInQueue),
    // `byIndex` is rebuilt every render, so it cannot be a dependency; these signatures are what
    // actually change the layout.
    [total, loadedKey, wantedKey, nextInQueue],
  );
  const rows = useMemo(
    () => [...byIndex.keys()].sort((a, b) => a - b).flatMap((i) => byIndex.get(i) ?? []),
    [loadedKey],
  );

  return {
    slots,
    rows,
    total,
    loading: total === undefined && !isError,
    isError,
    firstPageCount: byIndex.get(0)?.length ?? 0,
    requestRow,
  };
}

/** Lay the whole result set out as slots. Exported for its unit test. */
export function buildSlots<T>(
  byIndex: Map<number, T[]>,
  total: number | undefined,
  wanted: number[],
  nextInQueue: number | undefined,
): Slot<T>[] {
  if (total === undefined) return [];
  const pages = Math.ceil(total / PAGE_SIZE);
  const out: Slot<T>[] = [];
  for (let i = 0; i < pages; i += 1) {
    const rows = byIndex.get(i);
    if (rows) {
      for (const item of rows) out.push({ kind: 'row', item });
      continue;
    }
    const size = Math.min(PAGE_SIZE, total - i * PAGE_SIZE);
    // D29 — a placeholder band only where something is actually coming: the pages in flight and
    // the one next in the queue. Everywhere else the gap stays reserved empty height, exactly like
    // the trailing reserve it replaces. Consecutive gaps merge into one element.
    if (wanted.includes(i) || i === nextInQueue) {
      for (let k = 0; k < size; k += 1) out.push({ kind: 'skeleton' });
    } else {
      const last = out.at(-1);
      if (last?.kind === 'gap') last.rows += size;
      else out.push({ kind: 'gap', rows: size });
    }
  }
  return out;
}
