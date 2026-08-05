import type { RefObject } from 'react';
import type { JournalRow as Row } from '@macronome/shared';
import { useWindowRows } from '../../../lib/useWindowRows';
import { JournalCard } from './JournalCard';
import styles from '../journal-mobile.module.css';

// The Journal mobile card list (mobile-responsive S5): one card per day, in the order the
// sorted rows arrive (the Trier sheet drives the same client-side sort as the desktop table).
//
// B-267: like the desktop table, only the cards near the viewport are mounted — a phone is where
// a full year of DOM hurts most. Spacers above and below carry the rest of the height, so the
// scrollbar still spans the whole year.
interface JournalCardsProps {
  rows: Row[];
  onOpen: (row: Row) => void;
}

// Starting estimate only (real heights are measured as cards scroll in), plus the list's own
// `gap: var(--sp-5)`, which a measured box excludes.
const CARD_HEIGHT = 96;
const CARD_GAP = 10;

export function JournalCards({ rows, onOpen }: JournalCardsProps) {
  const win = useWindowRows(rows.length, CARD_HEIGHT, CARD_GAP);
  return (
    <div className={styles.cardList} ref={win.listRef as RefObject<HTMLDivElement>}>
      {win.padTop > 0 && <div aria-hidden="true" style={{ height: win.padTop }} />}
      {win.indexes.map((i) => {
        const row = rows[i];
        return row ? (
          <JournalCard key={row.date} row={row} onOpen={onOpen} index={i} measure={win.measure} />
        ) : null;
      })}
      {win.padBottom > 0 && <div aria-hidden="true" style={{ height: win.padBottom }} />}
    </div>
  );
}
