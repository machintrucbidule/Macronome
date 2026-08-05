import { useEffect, useState, type RefObject } from 'react';
import { rowsDemanded, useRowPitch } from './useRowPitch';

/**
 * Progressive list rendering, grow-only (B-275, superseding the B-267 virtualiser).
 *
 * The rule the owner set: **what has been rendered stays rendered**. So the rendered range is
 * always `[0, n)` — there is no sliding window, no top spacer, and nothing is ever unmounted
 * behind you. Scrolling back up can therefore never show an empty screen filling in.
 *
 * The page keeps scrolling (no scroll container): `design/components/data-tables.md` records that
 * a contained scroll and the appbar-anchored sticky header cannot coexist in one wrapper.
 *
 * For a list whose rows are **fetched** page by page rather than held in memory, see
 * `useListReserve` — same measured pitch, but it reserves height for rows not yet loaded.
 */
export const ROW_OVERSCAN = 50;

/** Rows drawn before anything is measured — enough to fill a tall viewport. */
const INITIAL_ROWS = 60;

export interface GrowingRows {
  /** Render `rows.slice(0, rendered)`. */
  rendered: number;
  /** Height to reserve after the last rendered row, so the scrollbar spans the whole list. */
  padBottom: number;
  /** Attach to the element that directly contains the rows. */
  listRef: RefObject<HTMLElement | null>;
}

/**
 * @param count total rows in the (already sorted/filtered) source array.
 * @param gap   CSS `gap` between rows in px, for a gapped flex list (the mobile card list).
 */
export function useGrowingRows(count: number, gap = 0): GrowingRows {
  const [rendered, setRendered] = useState(() => Math.min(count, INITIAL_ROWS));
  const shown = Math.min(rendered, count);
  const [pitch, listRef] = useRowPitch(shown, gap);

  useEffect(() => {
    if (pitch <= 0) return;
    const grow = (): void => {
      // Grow straight to what the current scroll position demands — one step, not a cascade. This
      // also covers arriving already scrolled (a restored offset, B-277).
      const needed = rowsDemanded(listRef.current, pitch, ROW_OVERSCAN);
      setRendered((prev) => (needed > prev ? Math.min(count, needed) : prev));
    };

    grow();
    window.addEventListener('scroll', grow, { passive: true });
    window.addEventListener('resize', grow);
    return () => {
      window.removeEventListener('scroll', grow);
      window.removeEventListener('resize', grow);
    };
  }, [count, pitch, listRef]);

  return {
    rendered: shown,
    padBottom: pitch > 0 ? Math.max(0, count - shown) * pitch : 0,
    listRef,
  };
}
