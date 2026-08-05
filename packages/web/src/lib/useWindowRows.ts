import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

/**
 * Window-virtualised list rows (B-267). Only the rows near the viewport are rendered, so a full
 * year of Journal days costs a screenful of DOM instead of 366 rows × 4 interactive controls.
 *
 * **Window**, not a scroll container: `design/components/data-tables.md` records that a contained
 * scroll and the appbar-anchored sticky header cannot coexist in one wrapper. The page keeps
 * scrolling, so the sticky `thead` (`top: var(--appbar-h)`) is untouched.
 *
 * The total height always covers **every** row (the real count × the estimate, refined by
 * measuring the rows on screen), so the scrollbar reflects the whole year — owner requirement.
 *
 * Consumers must set `data-index={index}` on each rendered row: that attribute is how the
 * virtualiser attributes a measured height to a row.
 */
export const ROW_OVERSCAN = 50;

export interface WindowRows {
  /** Indexes into the source array, in order, that should be rendered now. */
  indexes: number[];
  /** Spacer height before the first rendered row. */
  padTop: number;
  /** Spacer height after the last rendered row. */
  padBottom: number;
  /** Attach to the list container — its document offset anchors the window maths. */
  listRef: RefObject<HTMLElement | null>;
  /** Per-row ref: replaces the estimate with the row's real height. */
  measure: (el: Element | null) => void;
}

/**
 * @param gap  CSS `gap` between rows, in px, when the list is a gapped flex column (the mobile
 *   card list). A measured element's box excludes the gap, so it is added back — otherwise the
 *   total height, and with it the scrollbar, would fall short by one gap per row.
 */
export function useWindowRows(count: number, estimateRowHeight: number, gap = 0): WindowRows {
  const listRef = useRef<HTMLElement | null>(null);
  // The list does not start at the top of the document (appbar, toolbar, thead…). The offset is
  // only knowable after mount, so it is state: setting it re-runs the maths once, on mount.
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => {
    setOffset(listRef.current?.offsetTop ?? 0);
  }, [count]);

  const virtualizer = useWindowVirtualizer({
    count,
    estimateSize: () => estimateRowHeight + gap,
    overscan: ROW_OVERSCAN,
    scrollMargin: offset,
    measureElement: (el) => el.getBoundingClientRect().height + gap,
  });

  const items = virtualizer.getVirtualItems();
  const total = virtualizer.getTotalSize();
  const first = items[0];
  const last = items[items.length - 1];

  return {
    indexes: items.map((v) => v.index),
    padTop: first ? first.start - offset : 0,
    padBottom: last ? total - (last.end - offset) : 0,
    listRef,
    measure: virtualizer.measureElement,
  };
}
