import { useTranslation } from 'react-i18next';
import type { AdminUser } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { UserTable, type SortKey } from './UserTable';
import styles from '../users.module.css';

// Desktop Utilisateurs tree (screens/users.md): toolbar (title + count), lead, the
// sortable account table. No search / no add — accounts arrive via invitations (B-193).
interface UsersDesktopProps {
  rows: AdminUser[];
  selfId: string;
  loading: boolean;
  sort: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  errorKey: string | null;
  onDismissError: () => void;
  onRole: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
}

export function UsersDesktop(props: UsersDesktopProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div>
          <span className={styles.title}>{t('users.title')}</span>
          <span className={styles.count}>{t('users.count', { count: props.rows.length })}</span>
        </div>
      </div>
      <p className={styles.lead}>{t('users.lead')}</p>

      {props.errorKey && (
        <div className={styles.banner}>
          <Banner tone="warning" onDismiss={props.onDismissError}>
            {t(props.errorKey)}
          </Banner>
        </div>
      )}

      {props.loading ? (
        <SkeletonRows />
      ) : (
        <UserTable
          rows={props.rows}
          selfId={props.selfId}
          sort={props.sort}
          dir={props.dir}
          onSort={props.onSort}
          onRole={props.onRole}
          onDelete={props.onDelete}
        />
      )}
    </div>
  );
}
