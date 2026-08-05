import { SkeletonRows } from '../components/states/SkeletonRows';
import { useInfiniteScroll } from './useInfiniteScroll';

// Shared lazy-loading footer (LL-1/B-122): renders the IntersectionObserver sentinel
// that pulls the next page, plus a discreet skeleton while a page is in flight. Used by
// the Aliments and Recettes lists; takes the relevant fields off a `useInfiniteQuery`
// result (a structural subset, so the whole query object can be passed through).
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
}

export function InfiniteScrollFooter({ query, padBottom = 0 }: InfiniteScrollFooterProps) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const sentinelRef = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });
  return (
    <>
      {hasNextPage && <div ref={sentinelRef} aria-hidden="true" />}
      {isFetchingNextPage && <SkeletonRows count={2} />}
      {padBottom > 0 && <div aria-hidden="true" style={{ height: padBottom }} />}
    </>
  );
}
