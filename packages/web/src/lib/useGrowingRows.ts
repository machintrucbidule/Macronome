import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Progressive list rendering, grow-only (B-275, superseding the B-267 virtualiser).
 *
 * The rule the owner set: **what has been rendered stays rendered**. So the rendered range is
 * always `[0, rendered)` — there is no sliding window, no top spacer, and nothing is ever
 * unmounted behind you. Scrolling back up can therefore never show an empty screen filling in.
 *
 * Why not a virtualiser: it starts from an *estimated* row height and corrects it by measuring
 * rows as they scroll in. A 2px error over 366 rows moved the total by ~730px — the scrollbar grew
 * as you reached the bottom, and every correction re-rendered, which is what made blocks appear
 * one after another. Here the height is **measured from real rows before the first paint** and the
 * total only ever reflects that measurement.
 *
 * The page keeps scrolling (no scroll container): `design/components/data-tables.md` records that
 * a contained scroll and the appbar-anchored sticky header cannot coexist in one wrapper.
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
 * @param gap   CSS `gap` between rows in px, for a gapped flex list (the mobile cards). A measured
 *   container is `n·height + (n−1)·gap` tall, so the gap is added back to recover the true pitch.
 */
export function useGrowingRows(count: number, gap = 0): GrowingRows {
  const listRef = useRef<HTMLElement | null>(null);
  const [rendered, setRendered] = useState(() => Math.min(count, INITIAL_ROWS));
  // Row pitch (height + gap), measured — never guessed. 0 until the first measurement.
  const [pitch, setPitch] = useState(0);

  const shown = Math.min(rendered, count);

  // Measured before the browser paints, so the scrollbar is never briefly wrong.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || shown <= 0) return;
    const height = el.getBoundingClientRect().height;
    if (height <= 0) return;
    const next = (height + gap) / shown;
    // Ignore sub-pixel noise: a changing total is exactly the bug this replaces.
    if (Math.abs(next - pitch) > 0.5) setPitch(next);
  });

  useEffect(() => {
    if (pitch <= 0) return;

    const grow = (): void => {
      const el = listRef.current;
      if (!el) return;
      const listTop = el.getBoundingClientRect().top + window.scrollY;
      // Grow straight to what the current scroll position demands — one step, not a cascade. This
      // also covers arriving already scrolled (a restored offset, B-277).
      const needed =
        Math.ceil((window.scrollY + window.innerHeight - listTop) / pitch) + ROW_OVERSCAN;
      setRendered((prev) => (needed > prev ? Math.min(count, needed) : prev));
    };

    grow();
    window.addEventListener('scroll', grow, { passive: true });
    window.addEventListener('resize', grow);
    return () => {
      window.removeEventListener('scroll', grow);
      window.removeEventListener('resize', grow);
    };
  }, [count, pitch]);

  return {
    rendered: shown,
    padBottom: pitch > 0 ? Math.max(0, count - shown) * pitch : 0,
    listRef,
  };
}
