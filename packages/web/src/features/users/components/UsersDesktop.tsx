import { useTranslation } from 'react-i18next';
import type { AccountTokenSummary, AdminUser } from '@macronome/shared';
import { Banner } from '../../../components/Banner/Banner';
import { Button } from '../../../components/Button/Button';
import { SkeletonRows } from '../../../components/states/SkeletonRows';
import { PendingTokens } from './PendingTokens';
import { UserTable, type SortKey } from './UserTable';
import styles from '../users.module.css';

// Desktop Utilisateurs tree (screens/users.md): toolbar (title + count + Inviter),
// lead, the sortable account table, then the pending-links section (B-193/194).
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
  onInvite: () => void;
  onResetLink: (u: AdminUser) => void;
  tokens: AccountTokenSummary[];
  onRevoke: (id: string) => void;
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
        <Button variant="ghost" onClick={props.onInvite}>
          {t('users.invite')}
        </Button>
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
          onResetLink={props.onResetLink}
        />
      )}

      <PendingTokens tokens={props.tokens} onRevoke={props.onRevoke} />
    </div>
  );
}
