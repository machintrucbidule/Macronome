import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonRows } from '../components/states/SkeletonRows';
import { useInfiniteScroll } from './useInfiniteScroll';

// Shared lazy-loading footer (LL-1/B-122): renders the IntersectionObserver sentinel
// that pulls the next page, plus a discreet skeleton while a page is in flight. Used by
// the Aliments and Recettes lists; takes the relevant fields off a `useInfiniteQuery`
// result (a structural subset, so the whole query object can be passed through).
//
// B-272: it also carries the ONE polite live region those screens get. Page arrivals are
// otherwise invisible to a screen reader — the sentinel is aria-hidden and the skeleton only
// reports `aria-busy`. Keeping the region here rather than in each screen is what guarantees a
// single one per screen: several competing live regions are worse than none.
interface InfiniteScrollFooterProps {
  query: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
  };
  /**
   * Height of the rows the server says exist but that are not loaded yet (B-278, from
   * `useListReserve`). Reserving it makes the scrollbar span the whole catalogue from the first
   * page instead of growing as pages arrive.
   */
  padBottom?: number;
  /** Rows currently rendered — the live region announces how many just arrived (B-272). */
  loadedCount?: number;
}

export function InfiniteScrollFooter({
  query,
  padBottom = 0,
  loadedCount,
}: InfiniteScrollFooterProps) {
  const { t } = useTranslation();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const sentinelRef = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });
  const [announcement, setAnnouncement] = useState('');
  const previous = useRef<number | undefined>(loadedCount);

  useEffect(() => {
    const before = previous.current;
    previous.current = loadedCount;
    if (loadedCount === undefined || before === undefined) return;
    // Only growth is worth saying. A shrink means a new search, which the screen already reports
    // through its own count chip / empty state — repeating it here would double up.
    const added = loadedCount - before;
    if (added > 0) setAnnouncement(t('a11y.moreLoaded', { count: added }));
  }, [loadedCount, t]);

  return (
    <>
      {hasNextPage && <div ref={sentinelRef} aria-hidden="true" />}
      {isFetchingNextPage && <SkeletonRows count={2} />}
      {padBottom > 0 && <div aria-hidden="true" style={{ height: padBottom }} />}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
