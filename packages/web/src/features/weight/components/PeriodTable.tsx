import { useTranslation } from 'react-i18next';
import type { Period } from '@macronome/shared';
import { PeriodRow } from './PeriodRow';
import styles from '../weight.module.css';

// Period table (screens/weight.md §Period table), newest first. One row per period; the
// header columns mirror the contract's Period payload. Scrolls horizontally ≤900px.
const COLS = [
  'period',
  'days',
  'weight',
  'trend',
  'delta',
  'ecart',
  'bmi',
  'waist',
  'intake',
  'estBurn',
  'empBurn',
  'deficit',
  'activity',
  'flag',
  'note',
] as const;

// Numeric columns are right-aligned (data-tables.md: numeric headers match their column,
// mirroring the .num cells in PeriodRow). The first column (period) and the trailing text
// columns (flag, note) stay left-aligned.
const NUM_COLS = new Set([
  'days',
  'weight',
  'trend',
  'delta',
  'ecart',
  'bmi',
  'waist',
  'intake',
  'estBurn',
  'empBurn',
  'deficit',
  'activity',
]);

interface PeriodTableProps {
  periods: Period[];
  onRowClick: (endDate: string) => void;
}

export function PeriodTable({ periods, onRowClick }: PeriodTableProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th
                key={c}
                className={`${styles.colHead} ${NUM_COLS.has(c) ? styles.colHeadNum : ''}`}
              >
                {t(`weight.col.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <PeriodRow key={p.end_date} period={p} onClick={() => onRowClick(p.end_date)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
