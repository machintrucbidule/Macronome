import { useTranslation } from 'react-i18next';
import { Banner } from '../components/Banner/Banner';
import { useServerReachable } from './useServerReachable';
import styles from './AppShell.module.css';

// "Server unreachable" indicator (B-260, design/components/states.md). One global banner in the
// app frame instead of a different generic error on every screen — the app shell is precached
// (ADR-0003) but API responses are not, so an outage otherwise reads as "the window opened fine
// and then everything broke at once", the most confusing possible presentation.
//
// Deliberately NOT dismissible: hidden by accident it would leave stale calories, targets and
// weigh-ins looking current, and those drive real decisions. It clears itself on the first
// successful request.

export function OfflineBanner() {
  const { t } = useTranslation();
  const reachable = useServerReachable();
  if (reachable) return null;
  return (
    <div className={styles.offline}>
      <Banner tone="warning">{t('app.offline')}</Banner>
    </div>
  );
}
