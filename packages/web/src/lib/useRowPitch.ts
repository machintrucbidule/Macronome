import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * The height of a row, **measured** from the rows already on screen (B-275, reused by B-278).
 *
 * Measured, never estimated: the B-267 virtualiser guessed 38px where a Journal row is ~40px, and
 * the 2px error accumulated over 366 rows into ~730px — the scrollbar grew as you scrolled and the
 * last day shown was 17 days short. Anything reserving height for rows it has not drawn reads its
 * pitch from here instead.
 *
 * **Two heights, not one** (LD-1/B-303 follow-up). An Aliments row is taller when it draws the
 * comment sub-line, so a single average is wrong for every row that is not of the sampled mix —
 * and the first page is not a representative sample of the rest. Rows that carry the extra line
 * mark themselves `data-row-tall`, and the two variants are averaged separately. Averaged rather
 * than sampled from one row: a lone row can be a sub-pixel outlier (a real catalog measured 2 144
 * rows at 47.7px, five at 48.1 and one at 47.3), and that error would be multiplied by the whole
 * unloaded remainder.
 *
 * A list whose rows are all alike simply reports the same figure twice.
 *
 * Runs in a layout effect, so the value is known before the browser paints the first frame.
 */
export interface RowPitch {
  /** A row without the optional extra line. 0 until the first measurement. */
  base: number;
  /** A row carrying it. Falls back to `base` while none has been rendered. */
  tall: number;
}

/**
 * @param shown how many rows the container currently holds.
 * @param gap   CSS `gap` between rows in px, for a gapped flex list — a child's box excludes it,
 *   so it is added back to recover the true pitch.
 * @returns `[pitch, listRef]` — attach the ref to the element that directly contains the rows.
 */
export function useRowPitch(shown: number, gap = 0): [RowPitch, RefObject<HTMLElement | null>] {
  const listRef = useRef<HTMLElement | null>(null);
  const [pitch, setPitch] = useState<RowPitch>({ base: 0, tall: 0 });

  // Deps, not every render (LD-1/B-303): the measurement only changes when the row count, the gap
  // or the previous pitch does, and re-reading the layout on every render of a 3 400-row list is a
  // forced reflow nobody asked for. The `> 0.5` epsilon still guards the feedback loop.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || shown <= 0) return;
    const next = measure(el, gap);
    if (!next) return;
    if (Math.abs(next.base - pitch.base) > 0.5 || Math.abs(next.tall - pitch.tall) > 0.5) {
      setPitch(next);
    }
  }, [shown, gap, pitch]);

  return [pitch, listRef];
}

/** Average each variant over the rows in the container; null while none can be measured. */
function measure(el: HTMLElement, gap: number): RowPitch | null {
  const sum = { base: 0, tall: 0 };
  const count = { base: 0, tall: 0 };
  for (const child of el.children) {
    const height = child.getBoundingClientRect().height;
    if (height <= 0) continue;
    const kind = (child as HTMLElement).dataset.rowTall === undefined ? 'base' : 'tall';
    sum[kind] += height;
    count[kind] += 1;
  }
  if (count.base + count.tall === 0) return null;
  const base = count.base > 0 ? sum.base / count.base + gap : 0;
  const tall = count.tall > 0 ? sum.tall / count.tall + gap : 0;
  // Whichever variant has not been rendered yet borrows the other: a guess would be worse than
  // saying "as far as I can see, they are alike", and it self-corrects the moment one appears.
  return { base: base || tall, tall: tall || base };
}

/** Rows the current scroll position demands from a list starting at `listEl`, or 0 if unknown. */
export function rowsDemanded(listEl: HTMLElement | null, pitch: number, overscan: number): number {
  if (!listEl || pitch <= 0) return 0;
  const listTop = listEl.getBoundingClientRect().top + window.scrollY;
  return Math.ceil((window.scrollY + window.innerHeight - listTop) / pitch) + overscan;
}
