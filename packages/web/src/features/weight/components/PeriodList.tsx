import type { Period } from '@macronome/shared';
import { PeriodListRow } from './PeriodListRow';
import styles from '../weight-mobile.module.css';

// Mobile period list (mobile-responsive S8): the phone replacement for the 15-column
// PeriodTable, fed the same Period[] (newest first). Each row taps through to the detail sheet.
export function PeriodList({
  periods,
  onOpen,
}: {
  periods: Period[];
  onOpen: (period: Period) => void;
}) {
  return (
    <div className={styles.list}>
      {periods.map((p) => (
        <PeriodListRow key={p.end_date} period={p} onOpen={() => onOpen(p)} />
      ))}
    </div>
  );
}
