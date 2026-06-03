import type { ReactNode } from 'react';
import styles from './Banner.module.css';

// Inline status banner (design/components). Used for the persistent "targets
// inconsistent" warning on Cibles — a toast would be transient, but this condition
// must stay visible until the user fixes the targets. Tones map to semantic tokens.
interface BannerProps {
  tone?: 'warning' | 'info';
  children: ReactNode;
}

export function Banner({ tone = 'info', children }: BannerProps) {
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role="status">
      {children}
    </div>
  );
}
