import type { JournalRow as Row } from '@macronome/shared';
import { JournalCard } from './JournalCard';
import styles from '../journal-mobile.module.css';

// The Journal mobile card list (mobile-responsive S5): one card per day, in the order the
// sorted rows arrive (the Trier sheet drives the same client-side sort as the desktop table).
interface JournalCardsProps {
  rows: Row[];
  onOpen: (row: Row) => void;
}

export function JournalCards({ rows, onOpen }: JournalCardsProps) {
  return (
    <div className={styles.cardList}>
      {rows.map((row) => (
        <JournalCard key={row.date} row={row} onOpen={onOpen} />
      ))}
    </div>
  );
}
