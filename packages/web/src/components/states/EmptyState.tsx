import type { ReactNode } from 'react';
import styles from './states.module.css';

// Empty-state message (design/components/states.md): no foods / no match.
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
