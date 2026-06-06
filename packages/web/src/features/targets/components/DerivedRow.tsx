import type { ReactNode } from 'react';
import styles from '../cibles.module.css';

// A read-only "label (left) · server-computed value (right)" row in the manual-targets
// column (carb ceiling, target BMI) — per the Cibles mockup .row + .readout.
interface DerivedRowProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode | undefined;
}

export function DerivedRow({ label, value, hint }: DerivedRowProps) {
  return (
    <div className={styles.derivedRow}>
      <span className={styles.derivedLabel}>
        {label}
        {hint && <span className="hint"> {hint}</span>}
      </span>
      <span className={styles.derivedVal}>{value}</span>
    </div>
  );
}
