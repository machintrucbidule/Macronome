import type { Period } from '@macronome/shared';
import { PeriodListRow } from './PeriodListRow';
import styles from '../weight-mobile.module.css';

// Mobile period list (mobile-responsive S8): the phone replacement for the 15-column
// PeriodTable, fed the same Period[] (newest first). Each closed row taps through to the detail
// sheet; the optional open-interval lead row (B-176) taps straight to the reduced modal.
export function PeriodList({
  periods,
  openPeriod,
  onOpen,
  onOpenInterval,
}: {
  periods: Period[];
  openPeriod?: Period | null;
  onOpen: (period: Period) => void;
  onOpenInterval?: () => void;
}) {
  return (
    <div className={styles.list}>
      {openPeriod && onOpenInterval && (
        <PeriodListRow period={openPeriod} onOpen={onOpenInterval} />
      )}
      {periods.map((p) => (
        <PeriodListRow key={p.end_date} period={p} onOpen={() => onOpen(p)} />
      ))}
    </div>
  );
}
