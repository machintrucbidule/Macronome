import styles from './states.module.css';

interface SkeletonTableRowsProps {
  /** Placeholder rows to draw. */
  rows?: number;
  /**
   * Row height in px. Defaults to the shared table row (data-tables.md: `8px 10px` cell padding
   * around a `--fs-13` line box); a screen whose rows carry controls or a denser padding passes
   * its own — the point of the variant is that the placeholder occupies the real height.
   */
  rowHeight?: number;
}

// Skeleton rows at table row height (design/components/states.md §Loading states — "Aliments /
// tables: skeleton rows (greyed bars at row height)", B-264). Stands in for a whole <table>:
// a header band then N rows, so the page does not shift when the data lands.
//
// B-272: `aria-busy` on the outer element (in the accessibility tree), placeholders `aria-hidden`.
export function SkeletonTableRows({ rows = 8, rowHeight = 33 }: SkeletonTableRowsProps) {
  return (
    <div className={styles.skelTable} aria-busy="true" data-testid="skeleton-table">
      <div aria-hidden="true">
        <div className={styles.skelTableHead} />
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={styles.skelTableRow}
            style={{ height: rowHeight }}
            data-testid="skeleton-table-row"
          >
            <span className={styles.skelBar} />
          </div>
        ))}
      </div>
    </div>
  );
}
