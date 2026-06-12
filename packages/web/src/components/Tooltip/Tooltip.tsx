import type { ReactNode } from 'react';
import styles from './Tooltip.module.css';

// Small reusable hover tooltip (design/components/tooltip.md) — a styled bubble shown on
// hover/focus, the readable alternative to the native `title`. CSS-only (no JS state): the bubble
// is always in the DOM (role="tooltip") and revealed via :hover/:focus-within. Desktop affordance;
// callers attach it only where a pointer exists (e.g. the Journal table, replaced by cards on
// mobile). Pure presentation (CLAUDE.md rule 2).
interface TooltipProps {
  label: string;
  children: ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className={styles.wrap}>
      {children}
      <span role="tooltip" className={styles.bubble}>
        {label}
      </span>
    </span>
  );
}
