import { useMemo, useState } from 'react';
import type { AdminUser } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { useSession } from '../../app/useSession';
import { useIsMobile } from '../../lib/useIsMobile';
import { ApiError } from '../../api/client';
import { type SortKey } from './components/UserTable';
import { UsersDesktop } from './components/UsersDesktop';
import { UsersMobile } from './components/UsersMobile';
import { RoleConfirm } from './modals/RoleConfirm';
import { DeleteUserConfirm } from './modals/DeleteUserConfirm';
import { useUserMutations, useUsers } from './useUsers';

// Utilisateurs screen (specifications/screens/users.md, B-192): admin-only account
// management. Sort is client-side; role change behind a simple confirm, delete behind
// a typed confirm (retype the username). The caller's own row is locked (« (vous) »);
// guards (own_account, last_admin) are server-side and surfaced as a warning banner.
// It renders; it never computes.
type ModalState = { kind: 'role'; user: AdminUser } | { kind: 'delete'; user: AdminUser } | null;

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

export function UsersPage() {
  const [sort, setSort] = useState<SortKey>('created');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<ModalState>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const session = useSession();
  const list = useUsers();
  const { setRole, remove } = useUserMutations();
  const rows = useMemo(() => sortRows(list.data?.data ?? [], sort, dir), [list.data, sort, dir]);

  const onSort = (key: SortKey): void => {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir('asc');
    }
  };

  const mutate = (run: (onError: (e: unknown) => void) => void): void => {
    setErrorKey(null);
    run((e) => setErrorKey(errorKeyOf(e)));
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
  };

  return (
    <AppShell>
      {isMobile ? <UsersMobile {...common} /> : <UsersDesktop {...common} />}

      {modal?.kind === 'role' && (
        <RoleConfirm
          user={modal.user}
          pending={setRole.isPending}
          onCancel={() => setModal(null)}
          onConfirm={() =>
            mutate((onError) =>
              setRole.mutate({ id: modal.user.id, is_admin: !modal.user.is_admin }, { onError }),
            )
          }
        />
      )}

      {modal?.kind === 'delete' && (
        <DeleteUserConfirm
          user={modal.user}
          pending={remove.isPending}
          onCancel={() => setModal(null)}
          onConfirm={() => mutate((onError) => remove.mutate(modal.user.id, { onError }))}
        />
      )}
    </AppShell>
  );
}
