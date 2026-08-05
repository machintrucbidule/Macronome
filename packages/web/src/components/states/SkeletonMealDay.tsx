import styles from './states.module.css';

interface SkeletonMealDayProps {
  /** Meal columns to draw — the caller passes the layout's column count (1 on a phone). */
  columns?: number;
  /** Lines per column — the caller passes the effective displayed-line floor (B-203). */
  lines?: number;
}

// Repas loading state (design/components/states.md §Loading states — "Repas: skeleton totals row
// + skeleton meal columns", B-264). Reproduces the day header's totals band and the bordered
// column frame, so the screen keeps its shape while the day loads instead of collapsing to a
// strip of bars. Pure presentation: it renders nothing but placeholders.
export function SkeletonMealDay({ columns = 4, lines = 8 }: SkeletonMealDayProps) {
  return (
    // B-272: `aria-busy` outside, placeholders `aria-hidden` inside.
    <div aria-busy="true" data-testid="skeleton-meal-day">
      <div aria-hidden="true">
        <div className={styles.skelTotals} data-testid="skeleton-totals">
          <span className={styles.skelBar} />
          <span className={styles.skelBar} />
          <span className={styles.skelBar} />
        </div>
        <div className={styles.skelCols}>
          {Array.from({ length: columns }, (_, c) => (
            <div key={c} className={styles.skelCol} data-testid="skeleton-meal-column">
              <div className={styles.skelColHead}>
                <span className={styles.skelBar} />
              </div>
              {Array.from({ length: lines }, (_, l) => (
                <div key={l} className={styles.skelColLine} data-testid="skeleton-meal-line">
                  <span className={styles.skelBar} />
                </div>
              ))}
              <div className={styles.skelColFoot}>
                <span className={styles.skelBar} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
