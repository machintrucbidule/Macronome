import { useTranslation } from 'react-i18next';
import type { AccountTokenSummary, AdminUser } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { Button } from '../../../components/Button/Button';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { ListToolbar, SortSheet, type SortOption } from '../../../components/ListChrome';
import { PendingTokens } from './PendingTokens';
import { UserCards } from './UserCards';
import type { SortKey } from './UserTable';
import styles from '../users-mobile.module.css';

// Mobile Utilisateurs view (screens/users.md): count + Inviter + Trier sheet over a
// card list, then the pending-links section. No FAB; the app bar shows the title.
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
  onInvite: () => void;
  onResetLink: (u: AdminUser) => void;
  tokens: AccountTokenSummary[];
  onRevoke: (id: string) => void;
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
        <Button variant="ghost" onClick={props.onInvite}>
          {t('users.invite')}
        </Button>
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
          onResetLink={props.onResetLink}
        />
      )}

      <PendingTokens tokens={props.tokens} onRevoke={props.onRevoke} />
    </>
  );
}
