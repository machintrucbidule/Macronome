import { useTranslation } from 'react-i18next';
import type { AdminUser } from '@macronome/shared';
import { formatInstant } from '../format';
import styles from '../users.module.css';

// Account table (screens/users.md): Utilisateur · Créé le · Dernière connexion ·
// Dernière activité · Rôle · actions. The caller's own row is badged « (vous) »
// and its actions are disabled (owner decision: another admin must act).
export type SortKey = 'username' | 'created' | 'lastLogin' | 'lastSeen';

interface RowActions {
  onRole: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
  onResetLink: (u: AdminUser) => void;
}

interface Props extends RowActions {
  rows: AdminUser[];
  selfId: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}

function UserRow({ u, self, actions }: { u: AdminUser; self: boolean; actions: RowActions }) {
  const { t, i18n } = useTranslation();
  return (
    <tr>
      <td>
        {u.username}
        {self && <span className={styles.badge}>{t('users.you')}</span>}
      </td>
      <td className={styles.num}>{formatInstant(u.created_at, i18n.language)}</td>
      <td className={styles.num}>{formatInstant(u.last_login_at, i18n.language)}</td>
      <td className={styles.num}>{formatInstant(u.last_seen_at, i18n.language)}</td>
      <td>{t(u.is_admin ? 'account.typeAdmin' : 'account.typeUser')}</td>
      <td className={styles.a}>
        <button
          type="button"
          className={styles.action}
          disabled={self}
          onClick={() => actions.onRole(u)}
        >
          {t(u.is_admin ? 'users.demote' : 'users.promote')}
        </button>
        <button
          type="button"
          className={styles.action}
          disabled={self}
          title={t('users.resetLinkTitle')}
          onClick={() => actions.onResetLink(u)}
        >
          {t('users.resetLink')}
        </button>
        <button
          type="button"
          className={styles.del}
          disabled={self}
          title={t('common.remove')}
          onClick={() => actions.onDelete(u)}
        >
          ×
        </button>
      </td>
    </tr>
  );
}

export function UserTable({
  rows,
  selfId,
  sort,
  dir,
  onSort,
  onRole,
  onDelete,
  onResetLink,
}: Props) {
  const { t } = useTranslation();
  const arrow = (k: SortKey): string => (sort === k ? (dir === 'asc' ? ' ↑' : ' ↓') : '');
  const cols: Array<[SortKey, string]> = [
    ['username', 'users.col.username'],
    ['created', 'users.col.created'],
    ['lastLogin', 'users.col.lastLogin'],
    ['lastSeen', 'users.col.lastSeen'],
  ];
  const actions = { onRole, onDelete, onResetLink };

  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            {cols.map(([key, label]) => (
              <th key={key} onClick={() => onSort(key)}>
                {t(label)}
                {arrow(key)}
              </th>
            ))}
            <th className={styles.plain}>{t('users.col.role')}</th>
            <th className={styles.plain} aria-hidden />
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <UserRow key={u.id} u={u} self={u.id === selfId} actions={actions} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
