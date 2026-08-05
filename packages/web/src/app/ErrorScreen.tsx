import { useTranslation } from 'react-i18next';
import styles from './ErrorScreen.module.css';

// Fatal-error recovery card (design/components/states.md §Fatal error, B-265). Presentational
// only: it renders what failed and offers a reload. Shown by ErrorBoundary — in place of a screen
// (the appbar and nav stay usable) or full-page when the failure is below the router.
//
// A stale-chunk failure after an update (a hashed chunk the new build no longer serves) surfaces
// here as a render error, and the reload below is exactly its cure.
export function ErrorScreen({ detail }: { detail: string | null }) {
  const { t } = useTranslation();
  return (
    <div className={styles.wrap} role="alert">
      <h2 className={styles.title}>{t('fatal.title')}</h2>
      <p className={styles.lead}>{t('fatal.lead')}</p>
      {detail && <code className={styles.detail}>{detail}</code>}
      <button type="button" className={styles.action} onClick={() => window.location.reload()}>
        {t('fatal.reload')}
      </button>
    </div>
  );
}
