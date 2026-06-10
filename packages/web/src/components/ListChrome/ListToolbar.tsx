import type { ReactNode } from 'react';
import styles from './list-chrome.module.css';

// Shared mobile list toolbar (mobile-responsive S5, design/components/data-tables.md).
// A sticky bar under the app bar: a `leading` slot (a screen's year selector / search) on
// the left and trailing action controls (Trier, Filtres, "⋯") on the right. Generic so the
// four list screens reuse it; it is rendered only inside a useIsMobile() branch (desktop
// keeps its untouched <table>), so it never affects desktop.
interface ListToolbarProps {
  leading?: ReactNode;
  children?: ReactNode;
}

export function ListToolbar({ leading, children }: ListToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {leading != null && <div className={styles.leading}>{leading}</div>}
      <div className={styles.actions}>{children}</div>
    </div>
  );
}
