import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Form.module.css';

// Labelled text input (design/components/forms-inputs.md). `invalid` toggles the
// aria-invalid error styling.
interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  invalid?: boolean;
}

export function TextInput({ label, invalid, className, ...rest }: TextInputProps) {
  const input = (
    <input
      className={[styles.input, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
  if (!label) return input;
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {input}
    </label>
  );
}
