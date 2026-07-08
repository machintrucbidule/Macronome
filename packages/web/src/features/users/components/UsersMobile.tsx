import { useTranslation } from 'react-i18next';
import type { AdminUser } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { ListToolbar, SortSheet, type SortOption } from '../../../components/ListChrome';
import { UserCards } from './UserCards';
import type { SortKey } from './UserTable';
import styles from '../users-mobile.module.css';

// Mobile Utilisateurs view (screens/users.md): count + Trier sheet over a card list.
// No FAB (accounts arrive via invitations, B-193); the app bar shows the page title.
interface UsersMobileProps {
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

export function UsersMobile(props: UsersMobileProps) {
  const { t } = useTranslation();

  const sortOptions: SortOption<SortKey>[] = [
    { key: 'username', label: t('users.col.username') },
    { key: 'created', label: t('users.col.created') },
    { key: 'lastLogin', label: t('users.col.lastLogin') },
    { key: 'lastSeen', label: t('users.col.lastSeen') },
  ];

  return (
    <>
      <ListToolbar
        leading={
          <span className={styles.count}>{t('users.count', { count: props.rows.length })}</span>
        }
      >
        <SortSheet options={sortOptions} sort={props.sort} dir={props.dir} onSort={props.onSort} />
      </ListToolbar>

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
        <UserCards
          users={props.rows}
          selfId={props.selfId}
          onRole={props.onRole}
          onDelete={props.onDelete}
        />
      )}
    </>
  );
}
