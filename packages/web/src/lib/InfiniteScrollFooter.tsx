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
}

export function InfiniteScrollFooter({ query }: InfiniteScrollFooterProps) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const sentinelRef = useInfiniteScroll({ hasNextPage, isFetchingNextPage, fetchNextPage });
  return (
    <>
      {hasNextPage && <div ref={sentinelRef} aria-hidden="true" />}
      {isFetchingNextPage && <SkeletonRows count={2} />}
    </>
  );
}
