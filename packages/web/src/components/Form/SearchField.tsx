import type { InputHTMLAttributes } from 'react';
import styles from './Form.module.css';

// Search field with an inset magnifier (design/components/forms-inputs.md). The
// placeholder notes accent-insensitivity. Controlled value comes from the caller.
type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function SearchField(props: SearchFieldProps) {
  return (
    <span className={styles.search}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
      <input type="search" className={styles.input} {...props} />
    </span>
  );
}
