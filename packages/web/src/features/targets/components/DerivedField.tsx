import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../targets.module.css';

// A read-only derived figure rendered like the editable g/kg fields (B-071): a caption, a
// disabled/greyed box holding the server-computed value, and a "calculé" tag just to its right.
// Used for the carb ceiling and the target BMI — every figure comes from the engine readout.
interface DerivedFieldProps {
  label: ReactNode;
  value: ReactNode;
}

export function DerivedField({ label, value }: DerivedFieldProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.derivedField}>
      <span className={styles.derivedCaption}>{label}</span>
      <div className={styles.derivedFieldRow}>
        <span className={styles.derivedBox}>{value}</span>
        <span className={styles.calcTag}>{t('targets.targets.calculated')}</span>
      </div>
    </div>
  );
}
