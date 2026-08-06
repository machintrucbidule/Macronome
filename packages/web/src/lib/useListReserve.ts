import { useEffect, useRef, type RefObject } from 'react';
import { ROW_OVERSCAN } from './useGrowingRows';
import { rowsDemanded, useRowPitch } from './useRowPitch';
import type { PagedList } from './usePagedList';

/**
 * Turns the scroll position into "which page do I need" for a `usePagedList` list (LD-1/B-303,
 * superseding the B-278 reserve).
 *
 * Before, this hook chained cursor pages: it fired one `fetchNextPage`, waited, re-checked, fired
 * again — the only thing a keyset list could do, and ~68 serial round trips to reach the end of the
 * Ciqual catalog. Now it asks for the page **at** the position and lets `usePagedList` backfill.
 *
 * It still owns the measured row pitch, because that is what sizes the reserved gaps: the list
 * spans its whole result set from the first page, so the scrollbar is right immediately and does
 * not move as pages arrive.
 *
 * The pitch is measured from **page 0's rows only** — its container holds real rows and nothing
 * else. Skeletons and gaps are siblings of that container, the same separation B-275 used for the
 * Journal's trailing spacer, and for the same reason: a placeholder inside the measured box would
 * silently corrupt the pitch every row after it depends on.
 */
export interface ListReserve {
  /** Measured height of one row; 0 until the first measurement. Sizes the gap slots. */
  pitch: number;
  /** Attach to the element that directly contains page 0's rows. */
  listRef: RefObject<HTMLElement | null>;
}

export function useListReserve(list: PagedList<unknown>, gap = 0): ListReserve {
  const [pitch, listRef] = useRowPitch(list.firstPageCount, gap);
  const { requestRow } = list;
  // Read the latest requester without re-binding the scroll listener on every render.
  const requestRef = useRef(requestRow);
  requestRef.current = requestRow;

  useEffect(() => {
    if (pitch <= 0) return;
    let frame = 0;

    const pull = (): void => {
      // One layout read per frame at most: `scroll` fires far more often than the answer changes,
      // and `rowsDemanded` forces a reflow each time it runs.
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const demanded = rowsDemanded(listRef.current, pitch, ROW_OVERSCAN);
        if (demanded > 0) requestRef.current(demanded);
      });
    };

    pull();
    window.addEventListener('scroll', pull, { passive: true });
    window.addEventListener('resize', pull, { passive: true });
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', pull);
      window.removeEventListener('resize', pull);
    };
  }, [pitch, listRef]);

  return { pitch, listRef };
}
