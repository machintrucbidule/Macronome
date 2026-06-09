import { useCallback, useEffect, useRef, useState } from 'react';

// Reusable infinite-scroll sentinel (LL-1/B-122). Attach the returned ref to a small
// sentinel element placed after a list; when it scrolls into view (with a lookahead
// margin) and another page exists and none is in flight, it calls `fetchNextPage`.
// The viewport is the scroll container in this app, so the default IntersectionObserver
// root is correct. The observer is rebuilt whenever `hasNextPage`/`isFetchingNextPage`
// change so that a sentinel still in view after a page settles re-triggers the next
// fetch (IntersectionObserver reports the current intersection on observe), which keeps
// loading until the sentinel is pushed off-screen.
interface InfiniteScrollOptions {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  // `unknown` return so TanStack Query's promise-returning `fetchNextPage` is accepted.
  fetchNextPage: () => unknown;
  /** Lookahead distance before the sentinel becomes visible. */
  rootMargin?: string;
}

export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  rootMargin = '400px',
}: InfiniteScrollOptions) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const setRef = useCallback((el: HTMLDivElement | null) => setNode(el), []);

  // `fetchNextPage` identity can vary; read it from a ref so the observer effect only
  // re-runs on the flags that gate firing.
  const fetchRef = useRef(fetchNextPage);
  fetchRef.current = fetchNextPage;

  useEffect(() => {
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchRef.current();
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [node, hasNextPage, isFetchingNextPage, rootMargin]);

  return setRef;
}
