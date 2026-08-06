import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * The height of one row, **measured** from the rows already on screen (B-275, reused by B-278).
 *
 * Measured, never estimated: the B-267 virtualiser guessed 38px where a Journal row is ~40px, and
 * the 2px error accumulated over 366 rows into ~730px — the scrollbar grew as you scrolled and the
 * last day shown was 17 days short. Anything reserving height for rows it has not drawn reads its
 * pitch from here instead.
 *
 * Runs in a layout effect, so the value is known before the browser paints the first frame.
 *
 * @param shown how many rows the container currently holds.
 * @param gap   CSS `gap` between rows in px, for a gapped flex list. A measured container is
 *   `n·height + (n−1)·gap` tall, so the gap is added back to recover the true pitch.
 * @returns `[pitch, listRef]` — attach the ref to the element that directly contains the rows.
 *   `pitch` is 0 until the first measurement.
 */
export function useRowPitch(shown: number, gap = 0): [number, RefObject<HTMLElement | null>] {
  const listRef = useRef<HTMLElement | null>(null);
  const [pitch, setPitch] = useState(0);

  // Deps, not every render (LD-1/B-303): the measurement only changes when the row count, the gap
  // or the previous pitch does, and re-reading the layout on every render of a 3 400-row list is a
  // forced reflow nobody asked for. The `> 0.5` epsilon still guards the feedback loop.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || shown <= 0) return;
    const height = el.getBoundingClientRect().height;
    if (height <= 0) return;
    const next = (height + gap) / shown;
    // Ignore sub-pixel noise: a total that keeps changing is exactly the bug this replaces.
    if (Math.abs(next - pitch) > 0.5) setPitch(next);
  }, [shown, gap, pitch]);

  return [pitch, listRef];
}

/** Rows the current scroll position demands from a list starting at `listEl`, or 0 if unknown. */
export function rowsDemanded(listEl: HTMLElement | null, pitch: number, overscan: number): number {
  if (!listEl || pitch <= 0) return 0;
  const listTop = listEl.getBoundingClientRect().top + window.scrollY;
  return Math.ceil((window.scrollY + window.innerHeight - listTop) / pitch) + overscan;
}
