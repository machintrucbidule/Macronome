import type { ReactNode } from 'react';
import styles from './Form.module.css';

// Filter chip (design/components/forms-inputs.md). `pressed` drives the selected
// (aria-pressed) accent styling. Used by the rating-minimum and visibility filters.
interface ChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function Chip({ pressed, onClick, children }: ChipProps) {
  return (
    <button type="button" className={styles.chip} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}
