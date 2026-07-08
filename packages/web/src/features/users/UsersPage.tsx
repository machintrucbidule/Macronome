import { useMemo, useState } from 'react';
import type { AdminUser, CreatedToken } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { useSession } from '../../app/useSession';
import { useIsMobile } from '../../lib/useIsMobile';
import { ApiError } from '../../api/client';
import { type SortKey } from './components/UserTable';
import { UsersDesktop } from './components/UsersDesktop';
import { UsersMobile } from './components/UsersMobile';
import { RoleConfirm } from './modals/RoleConfirm';
import { DeleteUserConfirm } from './modals/DeleteUserConfirm';
import { InviteModal } from './modals/InviteModal';
import { ResetLinkModal } from './modals/ResetLinkModal';
import { useUserMutations, useUsers } from './useUsers';
import { useTokenMutations, useTokens } from './useTokens';

// Utilisateurs screen (specifications/screens/users.md, B-192..194): admin-only
// account management. Sort is client-side; role change behind a simple confirm,
// delete behind a typed confirm (retype the username); invitation + reset links
// (single-use, 7-day) created here and listed in a pending section. The caller's
// own row is locked (« (vous) »); guards (own_account, last_admin) are
// server-side and surfaced as a warning banner. It renders; it never computes.
type ModalState =
  | { kind: 'role'; user: AdminUser }
  | { kind: 'delete'; user: AdminUser }
  | { kind: 'invite' }
  | { kind: 'resetLink'; user: AdminUser; link: CreatedToken }
  | null;

function errorKeyOf(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'last_admin') return 'users.errors.lastAdmin';
    if (err.code === 'own_account') return 'users.errors.ownAccount';
  }
  return 'users.errors.generic';
}

function sortRows(rows: AdminUser[], sort: SortKey, dir: 'asc' | 'desc'): AdminUser[] {
  const sign = dir === 'asc' ? 1 : -1;
  const key = (u: AdminUser): string => {
    if (sort === 'username') return u.username;
    if (sort === 'lastLogin') return u.last_login_at ?? '';
    if (sort === 'lastSeen') return u.last_seen_at ?? '';
    return u.created_at;
  };
  return [...rows].sort((a, b) =>
    sort === 'username'
      ? a.username.localeCompare(b.username, 'fr') * sign
      : key(a).localeCompare(key(b)) * sign,
  );
}

interface Mutations {
  setRole: ReturnType<typeof useUserMutations>['setRole'];
  remove: ReturnType<typeof useUserMutations>['remove'];
  run: (fn: (onError: (e: unknown) => void) => void) => void;
}

function PageModals({
  modal,
  close,
  mut,
}: {
  modal: ModalState;
  close: () => void;
  mut: Mutations;
}) {
  if (!modal) return null;
  if (modal.kind === 'invite') return <InviteModal onClose={close} />;
  if (modal.kind === 'resetLink') {
    return <ResetLinkModal user={modal.user} link={modal.link} onClose={close} />;
  }
  if (modal.kind === 'role') {
    return (
      <RoleConfirm
        user={modal.user}
        pending={mut.setRole.isPending}
        onCancel={close}
        onConfirm={() =>
          mut.run((onError) =>
            mut.setRole.mutate({ id: modal.user.id, is_admin: !modal.user.is_admin }, { onError }),
          )
        }
      />
    );
  }
  return (
    <DeleteUserConfirm
      user={modal.user}
      pending={mut.remove.isPending}
      onCancel={close}
      onConfirm={() => mut.run((onError) => mut.remove.mutate(modal.user.id, { onError }))}
    />
  );
}

export function UsersPage() {
  const [sort, setSort] = useState<SortKey>('created');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<ModalState>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const session = useSession();
  const list = useUsers();
  const tokens = useTokens();
  const { setRole, remove } = useUserMutations();
  const { createResetToken, revoke } = useTokenMutations();
  const rows = useMemo(() => sortRows(list.data?.data ?? [], sort, dir), [list.data, sort, dir]);

  const onSort = (key: SortKey): void => {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir('asc');
    }
  };

  const onError = (e: unknown): void => setErrorKey(errorKeyOf(e));
  const run = (fn: (onErr: (e: unknown) => void) => void): void => {
    setErrorKey(null);
    fn(onError);
    setModal(null);
  };

  const common = {
    rows,
    selfId: session.data?.user.id ?? '',
    loading: list.isLoading,
    sort,
    dir,
    onSort,
    errorKey,
    onDismissError: () => setErrorKey(null),
    onRole: (user: AdminUser) => setModal({ kind: 'role', user }),
    onDelete: (user: AdminUser) => setModal({ kind: 'delete', user }),
    onInvite: () => setModal({ kind: 'invite' }),
    onResetLink: (user: AdminUser) => {
      setErrorKey(null);
      createResetToken.mutate(user.id, {
        onSuccess: (res) => setModal({ kind: 'resetLink', user, link: res.data }),
        onError,
      });
    },
    tokens: tokens.data?.data ?? [],
    onRevoke: (id: string) => {
      setErrorKey(null);
      revoke.mutate(id, { onError });
    },
  };

  return (
    <AppShell>
      {isMobile ? <UsersMobile {...common} /> : <UsersDesktop {...common} />}
      <PageModals modal={modal} close={() => setModal(null)} mut={{ setRole, remove, run }} />
    </AppShell>
  );
}
