import { useEffect, type RefObject } from 'react';
import { ROW_OVERSCAN } from './useGrowingRows';
import { rowsDemanded, useRowPitch } from './useRowPitch';

/**
 * Scrollbar and page-loading for a **cursor-paginated** list (B-278): Aliments and Recettes fetch
 * 50 rows at a time, so unlike the Journal they cannot know their own length — the server now says
 * how many rows match (`total` on the list envelope).
 *
 * Two jobs, both needing the same measured row pitch (`useRowPitch`):
 *  - reserve `(total − loaded) × pitch` below the loaded rows, so the scrollbar spans the whole
 *    catalogue from the first page instead of growing as pages arrive;
 *  - **keep fetching while the scroll position demands rows beyond those loaded.** Without this the
 *    reserve would be a trap: the IntersectionObserver sentinel only fires when it is near the
 *    viewport, so dragging the scrollbar past it would leave a permanently empty area. Cursor pages
 *    are inherently sequential (each needs the previous one's cursor), so exactly one request is in
 *    flight at a time and the chain stops when the visible range is covered.
 */
export interface ListReserveQuery {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
}

export interface ListReserve {
  /** Height to reserve after the last loaded row. */
  padBottom: number;
  /** Attach to the element that directly contains the rows. */
  listRef: RefObject<HTMLElement | null>;
  /** Spread straight into `<InfiniteScrollFooter>`: the reserve height it must render, and the
   *  loaded count its live region announces page arrivals from (B-272). Bundled because every
   *  call site passes both and neither is the caller's decision. */
  footer: { padBottom: number; loadedCount: number };
}

export function useListReserve(
  loaded: number,
  total: number | undefined,
  query: ListReserveQuery,
  gap = 0,
): ListReserve {
  const [pitch, listRef] = useRowPitch(loaded, gap);
  const missing = total === undefined ? 0 : Math.max(0, total - loaded);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (pitch <= 0 || !hasNextPage || isFetchingNextPage || missing <= 0) return;

    const pull = (): void => {
      if (rowsDemanded(listRef.current, pitch, ROW_OVERSCAN) > loaded) fetchNextPage();
    };

    // Re-checked on every render of this effect's inputs, so a page landing immediately re-tests
    // whether the position still demands more — that is what chains the pages.
    pull();
    window.addEventListener('scroll', pull, { passive: true });
    window.addEventListener('resize', pull);
    return () => {
      window.removeEventListener('scroll', pull);
      window.removeEventListener('resize', pull);
    };
  }, [pitch, loaded, missing, hasNextPage, isFetchingNextPage, fetchNextPage, listRef]);

  const padBottom = pitch > 0 ? missing * pitch : 0;
  return { padBottom, listRef, footer: { padBottom, loadedCount: loaded } };
}
