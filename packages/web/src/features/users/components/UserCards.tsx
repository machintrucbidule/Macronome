import { useTranslation } from 'react-i18next';
import type { AdminUser } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { formatInstant } from '../format';
import styles from '../users-mobile.module.css';

// Mobile account list (screens/users.md): the phone replacement for the table, fed
// the same sorted AdminUser[]. Cards are static (no edit sheet); actions are inline
// buttons, disabled on the caller's own card (owner decision).
export function UserCards({
  users,
  selfId,
  onRole,
  onDelete,
  onResetLink,
}: {
  users: AdminUser[];
  selfId: string;
  onRole: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
  onResetLink: (u: AdminUser) => void;
}) {
  return (
    <div className={styles.cardList}>
      {users.map((u) => (
        <UserCard
          key={u.id}
          user={u}
          self={u.id === selfId}
          onRole={onRole}
          onDelete={onDelete}
          onResetLink={onResetLink}
        />
      ))}
    </div>
  );
}

function UserCard({
  user,
  self,
  onRole,
  onDelete,
  onResetLink,
}: {
  user: AdminUser;
  self: boolean;
  onRole: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
  onResetLink: (u: AdminUser) => void;
}) {
  const { t, i18n } = useTranslation();
  const stamp = (label: string, iso: string | null): string =>
    `${t(label)} · ${formatInstant(iso, i18n.language)}`;

  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.name}>{user.username}</span>
        {self && <span className={styles.tag}>{t('users.you')}</span>}
        <span className={styles.tag}>
          {t(user.is_admin ? 'account.typeAdmin' : 'account.typeUser')}
        </span>
      </div>
      <div className={styles.meta}>
        <span>{stamp('users.col.created', user.created_at)}</span>
        <span>{stamp('users.col.lastLogin', user.last_login_at)}</span>
        <span>{stamp('users.col.lastSeen', user.last_seen_at)}</span>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" disabled={self} onClick={() => onRole(user)}>
          {t(user.is_admin ? 'users.demote' : 'users.promote')}
        </Button>
        <Button variant="ghost" disabled={self} onClick={() => onResetLink(user)}>
          {t('users.resetLink')}
        </Button>
        <Button variant="danger" disabled={self} onClick={() => onDelete(user)}>
          {t('common.remove')}
        </Button>
      </div>
    </div>
  );
}
