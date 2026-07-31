import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppShell } from '../../app/AppShell';
import { EmptyState } from '../../components/states/EmptyState';
import styles from './not-found.module.css';

// Catch-all screen (design/components/states.md §Page introuvable, B-241). Before it, an unknown
// URL loaded the SPA, matched no route and rendered nothing — a blank page with no way back.
// Sits inside the normal app shell and behind RequireAuth like every other route, so a
// logged-out visitor is sent to /login rather than shown the app frame. Reuses the shared
// EmptyState line; the only addition is the way home.
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('notFound.title')}</h1>
        <EmptyState>{t('notFound.body')}</EmptyState>
        <Link to="/" className={styles.home}>
          {t('notFound.home')}
        </Link>
      </div>
    </AppShell>
  );
}
