import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Banner.module.css';

// Inline status banner (design/components/toasts-warnings.md). Used for the persistent
// "targets inconsistent" warning on Cibles and for non-blocking load/save failure banners
// (§D), which are dismissible — pass `onDismiss` to render the close (×) affordance. Tones
// map to semantic tokens.
interface BannerProps {
  tone?: 'warning' | 'info';
  /** When provided, a close (×) button is shown that calls this to dismiss the banner (§D). */
  onDismiss?: () => void;
  children: ReactNode;
}

export function Banner({ tone = 'info', onDismiss, children }: BannerProps) {
  const { t } = useTranslation();
  return (
    <div className={`${styles.banner} ${styles[tone]}`} role="status">
      <span className={styles.content}>{children}</span>
      {onDismiss && (
        <button
          type="button"
          className={styles.close}
          onClick={onDismiss}
          aria-label={t('common.close')}
        >
          ×
        </button>
      )}
    </div>
  );
}
