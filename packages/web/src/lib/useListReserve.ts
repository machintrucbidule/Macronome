import { useEffect, useRef, type RefObject } from 'react';
import { ROW_OVERSCAN } from './useGrowingRows';
import { rowsDemanded, useRowPitch } from './useRowPitch';
import type { PagedList } from './usePagedList';

/**
 * Turns the scroll position into "which page do I need" for a `usePagedList` list, and sizes the
 * height reserved for the rows it has not loaded (LD-1/B-303, superseding the B-278 reserve).
 *
 * Before, this hook chained cursor pages: it fired one `fetchNextPage`, waited, re-checked, fired
 * again — the only thing a keyset list could do, and ~68 serial round trips to reach the end of the
 * Ciqual catalog. Now it asks for the page **at** the position and lets `usePagedList` backfill.
 *
 * **The reserve is computed, not averaged** (B-303 follow-up). An Aliments row is taller when it
 * draws its comment sub-line, and the first page is not a representative sample of the rest — so
 * the server reports how many of the matching rows carry one, the two heights are measured
 * separately, and what is reserved is the exact height of what is missing:
 *
 *     remaining tall = with_comment − (loaded rows carrying one)
 *     remaining base = (total − loaded) − remaining tall
 *
 * The loaded part is real DOM and the remainder is counted, so the document height is right at
 * every step rather than converging. One honest limit: when the remainder is split across several
 * gaps it is apportioned between them by row count, so a single gap can be slightly off while the
 * sum stays exact — that only shifts which page a position maps to, and the next scroll corrects it.
 *
 * The pitch is measured from **page 0's rows only** — its container holds real rows and nothing
 * else. Skeletons and gaps are siblings of that container, the same separation B-275 used for the
 * Journal's trailing spacer, and for the same reason: a placeholder inside the measured box would
 * corrupt the pitch that every reserved gap depends on.
 */
export interface ListReserve {
  /** Height to give one unloaded row — the exact average of the rows still missing. 0 until
   *  the first measurement. */
  pitch: number;
  /** Attach to the element that directly contains page 0's rows. */
  listRef: RefObject<HTMLElement | null>;
}

export function useListReserve(list: PagedList<unknown>, gap = 0): ListReserve {
  const [measured, listRef] = useRowPitch(list.firstPageCount, gap);
  const { requestRow } = list;
  // Read the latest requester without re-binding the scroll listener on every render.
  const requestRef = useRef(requestRow);
  requestRef.current = requestRow;

  const missing = Math.max(0, (list.total ?? 0) - list.rows.length);
  const missingTall = Math.min(missing, Math.max(0, list.withTall - list.loadedTall));
  const missingBase = missing - missingTall;
  const pitch =
    missing > 0
      ? (missingBase * measured.base + missingTall * measured.tall) / missing
      : measured.base;

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
