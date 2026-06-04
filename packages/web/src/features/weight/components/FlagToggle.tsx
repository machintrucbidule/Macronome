import { useTranslation } from 'react-i18next';
import type { DietFlag } from '@macronome/shared';
import styles from '../weight.module.css';

// Régime / Maintien segmented toggle. Reused by the header (screen-local current mode) and
// the weigh-in modal (the period's diet flag). Both are the same two-value choice.
const FLAGS: DietFlag[] = ['in_diet', 'not_in_diet'];

interface FlagToggleProps {
  value: DietFlag;
  onChange: (f: DietFlag) => void;
}

export function FlagToggle({ value, onChange }: FlagToggleProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.flagToggle} role="group">
      {FLAGS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={f === value}
          className={f === value ? styles.flagOn : styles.flagBtn}
          onClick={() => onChange(f)}
        >
          {t(`weight.flag.${f}`)}
        </button>
      ))}
    </div>
  );
}
