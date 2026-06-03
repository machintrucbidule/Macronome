import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Form.module.css';

// Numeric input with an optional unit suffix (kcal / g) and label
// (design/components/forms-inputs.md). Used by the food macro fields.
interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  suffix?: string;
  invalid?: boolean;
}

export function NumberInput({ label, suffix, invalid, className, ...rest }: NumberInputProps) {
  const field = [styles.input, styles.num, className].filter(Boolean).join(' ');
  const input = (
    <input type="number" className={field} aria-invalid={invalid || undefined} {...rest} />
  );
  const control = suffix ? (
    <span className={styles.withSuffix}>
      {input}
      <span className={styles.suffix}>{suffix}</span>
    </span>
  ) : (
    input
  );
  if (!label) return control;
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {control}
    </label>
  );
}
