import type { RefObject } from 'react';
import type { JournalRow as Row } from '@macronome/shared';
import { useGrowingRows } from '../../../lib/useGrowingRows';
import { JournalCard } from './JournalCard';
import styles from '../journal-mobile.module.css';

// The Journal mobile card list (mobile-responsive S5): one card per day, in the order the
// sorted rows arrive (the Trier sheet drives the same client-side sort as the desktop table).
//
// B-267/B-275: cards are rendered progressively — a phone is where a full year of DOM hurts most —
// and, like the desktop table, rendering only ever grows: a card already drawn is never taken
// back. A trailing spacer carries the height of the rest so the scrollbar spans the whole year.
// Unlike the desktop rows, cards differ in height (the comment line is conditional), so the pitch
// is the measured average of what has been drawn; it converges as you scroll and never shrinks.
interface JournalCardsProps {
  rows: Row[];
  onOpen: (row: Row) => void;
}

/** The list's own `gap: var(--sp-5)`, which a measured container excludes between its children. */
const CARD_GAP = 10;

export function JournalCards({ rows, onOpen }: JournalCardsProps) {
  const win = useGrowingRows(rows.length, CARD_GAP);
  return (
    <>
      <div className={styles.cardList} ref={win.listRef as RefObject<HTMLDivElement>}>
        {rows.slice(0, win.rendered).map((row) => (
          <JournalCard key={row.date} row={row} onOpen={onOpen} />
        ))}
      </div>
      {win.padBottom > 0 && <div aria-hidden="true" style={{ height: win.padBottom }} />}
    </>
  );
}
