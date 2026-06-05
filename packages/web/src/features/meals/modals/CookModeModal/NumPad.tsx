import type { ReactNode } from 'react';
import styles from './cook-mode.module.css';

// Numeric keypad for cook mode (specifications/screens/meals.md §Cook mode): greyed/disabled
// until a quantity is tapped. Digits + comma feed the buffer; ⌫ deletes. Pure presentational —
// the working copy lives in useCookSession.
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫'] as const;

interface NumPadProps {
  disabled: boolean;
  hint: ReactNode;
  onKey: (ch: string) => void;
  onBackspace: () => void;
}

export function NumPad({ disabled, hint, onKey, onBackspace }: NumPadProps) {
  return (
    <>
      <div className={styles.hint}>{hint}</div>
      <div className={`${styles.numpad} ${disabled ? styles.padDisabled : ''}`}>
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => (k === '⌫' ? onBackspace() : onKey(k))}
          >
            {k}
          </button>
        ))}
      </div>
    </>
  );
}
