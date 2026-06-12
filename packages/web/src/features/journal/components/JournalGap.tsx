import { signedInt } from '../../../lib/format/number';
import styles from '../journal.module.css';

// A signed kcal écart on a desktop Journal row: the verdict-column écart vs the target (B-138,
// `kcal_gap`) and the activity-column écart vs the estimated expenditure (B-163, `burn_gap`) share
// the exact same look. Server-provided value, the web only renders it (CLAUDE.md rule 2): green at/
// under 0, red above; nothing when null (the server omits it on non-applicable days).
interface JournalGapProps {
  value: number | null;
}

export function JournalGap({ value }: JournalGapProps) {
  if (value === null) return null;
  return (
    <span className={`${styles.gap} ${value > 0 ? styles.gapOver : styles.gapUnder}`}>
      {signedInt(value)}
    </span>
  );
}
