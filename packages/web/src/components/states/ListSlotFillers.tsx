import type { ReactNode } from 'react';
import type { Slot } from '../../lib/usePagedList';
import styles from './states.module.css';

// The two fillers a paged list draws for rows it does not hold yet (LD-1/B-303, D29):
// a **placeholder** where a page is actually coming, and a **gap** — reserved empty height —
// everywhere else. The gap is what the B-278 trailing reserve became once a list could have a
// hole in the middle rather than only a tail.
//
// Neither existing skeleton could be reused: `SkeletonTableRows` renders <div>s, which cannot live
// inside a <tbody>, and `SkeletonRows` wraps its bars in two extra elements, which would corrupt
// the card list's measured pitch. These emit exactly one element per slot.
//
// B-272: the placeholders are `aria-hidden` — a screen reader is told the region is busy by the
// list's own `aria-busy`, and a row of decorative bars is not content. The gap is decorative too.

/** Placeholder row inside a <tbody>. `columns` must match the table, or the layout desyncs. */
export function SkeletonRowCells({ columns, height }: { columns: number; height: number }) {
  return (
    <tr aria-hidden="true" style={{ height }} data-testid="slot-skeleton">
      <td colSpan={columns}>
        <span className={styles.skelBar} style={{ display: 'block', height: 10 }} />
      </td>
    </tr>
  );
}

/** Reserved empty height inside a <tbody>, standing in for rows never requested yet. */
export function GapRow({ columns, height }: { columns: number; height: number }) {
  return (
    <tr aria-hidden="true" data-testid="slot-gap">
      <td colSpan={columns} style={{ height, padding: 0, border: 0 }} />
    </tr>
  );
}

/** Placeholder card, at the measured card height. */
export function SkeletonCard({ height }: { height: number }) {
  return (
    <div aria-hidden="true" style={{ height }} data-testid="slot-skeleton">
      <span className={styles.skelBar} style={{ display: 'block', height: '100%' }} />
    </div>
  );
}

/** Reserved empty height in a card list. */
export function GapBlock({ height }: { height: number }) {
  return <div aria-hidden="true" style={{ height }} data-testid="slot-gap" />;
}

interface SlotsProps<T> {
  slots: Slot<T>[];
  /** Measured row height; 0 before the first measurement, when nothing can be sized yet. */
  pitch: number;
  /** Offset of `slots` within the whole list, so row keys stay unique across the two containers. */
  offset?: number;
  children: (item: T, index: number) => ReactNode;
}

/** Render a run of slots as table rows. `columns` must match the table's column count. */
export function TableSlots<T>({
  slots,
  pitch,
  columns,
  offset = 0,
  children,
}: SlotsProps<T> & { columns: number }) {
  return (
    <>
      {slots.map((slot, i) => {
        const key = offset + i;
        if (slot.kind === 'row') return children(slot.item, key);
        if (slot.kind === 'skeleton')
          return <SkeletonRowCells key={key} columns={columns} height={pitch} />;
        return <GapRow key={key} columns={columns} height={slot.rows * pitch} />;
      })}
    </>
  );
}

/** Render a run of slots as cards. */
export function CardSlots<T>({ slots, pitch, offset = 0, children }: SlotsProps<T>) {
  return (
    <>
      {slots.map((slot, i) => {
        const key = offset + i;
        if (slot.kind === 'row') return children(slot.item, key);
        if (slot.kind === 'skeleton') return <SkeletonCard key={key} height={pitch} />;
        return <GapBlock key={key} height={slot.rows * pitch} />;
      })}
    </>
  );
}
