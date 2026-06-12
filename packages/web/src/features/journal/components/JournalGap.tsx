import { useTranslation } from 'react-i18next';
import { formatInt, signedInt } from '../../../lib/format/number';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import styles from '../journal.module.css';

// A signed kcal écart on a desktop Journal row: the verdict-column écart vs the target (B-138,
// `kcal_gap`, kind="target") and the activity-column écart vs the estimated expenditure (B-163,
// `burn_gap`, kind="burn") share the exact same look. Server-provided value, the web only renders
// it (CLAUDE.md rule 2): green at/under 0, red above; nothing when null. On desktop each écart
// carries a hover tooltip spelling out the figure (B-164); the mobile cards omit it by rendering
// their own plain span (not this component).
interface JournalGapProps {
  value: number | null;
  kind: 'target' | 'burn';
}

export function JournalGap({ value, kind }: JournalGapProps) {
  const { t } = useTranslation();
  if (value === null) return null;
  const over = value > 0;
  const key =
    kind === 'target'
      ? over
        ? 'journal.gap.targetOver'
        : 'journal.gap.targetUnder'
      : over
        ? 'journal.gap.burnOver'
        : 'journal.gap.burnUnder';
  return (
    <Tooltip label={t(key, { n: formatInt(Math.abs(value)) })}>
      <span className={`${styles.gap} ${over ? styles.gapOver : styles.gapUnder}`}>
        {signedInt(value)}
      </span>
    </Tooltip>
  );
}
