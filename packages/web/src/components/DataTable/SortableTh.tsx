import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

// Sortable table header cell (design/components/data-tables.md). Shows the active
// sort arrow (▼/▲) in the accent colour; re-clicking toggles direction (handled by
// the caller). `align` matches numeric columns to right/centre.
interface SortableThProps {
  field: string;
  active: boolean;
  dir: 'asc' | 'desc';
  align?: 'left' | 'right' | 'center';
  onSort: (field: string) => void;
  children: ReactNode;
}

export function SortableTh({
  field,
  active,
  dir,
  align = 'left',
  onSort,
  children,
}: SortableThProps) {
  const alignClass = align === 'right' ? styles.r : align === 'center' ? styles.c : '';
  return (
    <th
      className={`${styles.sortable} ${alignClass} ${active ? styles.sorted : ''}`}
      onClick={() => onSort(field)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {children} {active && <span className={styles.arr}>{dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}

export { styles as tableStyles };
