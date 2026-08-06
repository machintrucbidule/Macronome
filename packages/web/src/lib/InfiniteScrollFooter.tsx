import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Live region for the lazy-loading lists (B-272): page arrivals are otherwise invisible to a
// screen reader. Keeping it here rather than in each screen is what guarantees a single one per
// screen — several competing live regions are worse than none.
//
// LD-1/B-303 emptied the rest of this component. It used to carry the IntersectionObserver
// sentinel that pulled the next page AND the trailing reserve height, and both moved:
//  - the sentinel was a **second loader** racing `useListReserve`'s scroll handler, so the two are
//    now one — the reserve asks for the page at the scroll position and nothing else fetches;
//  - the reserve is no longer a trailing block. A list can have a hole in the middle now, so the
//    unloaded height is expressed as gap slots inside the rows themselves.
interface InfiniteScrollFooterProps {
  /** Rows currently rendered — the live region announces how many just arrived. */
  loadedCount?: number;
}

export function InfiniteScrollFooter({ loadedCount }: InfiniteScrollFooterProps) {
  const { t } = useTranslation();
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
    <div role="status" aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
}
