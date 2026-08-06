import { useMemo, useState } from 'react';
import type { Container } from '@macronome/shared';
import { useIsMobile } from '../../lib/useIsMobile';
import { type SortKey } from './components/ContainerTable';
import { ContainersDesktop } from './components/ContainersDesktop';
import { ContainersMobile } from './components/ContainersMobile';
import { ContainerModal } from './modals/ContainerModal';
import { DeleteConfirm } from './modals/DeleteConfirm';
import { useContainerMutations, useContainers } from './useContainers';
import { notifyUndoable } from '../../components/Toast/notify';

// Contenants screen (specifications/screens/containers.md): the tare catalog. Search +
// sort are client-side over the full list; the built-in "Rien" stays pinned first and
// locked. Add/edit via modal; free delete with a confirm. It renders; it never computes.
// Mobile-responsive follow-up: a useIsMobile() render-switch picks the desktop tree
// (ContainersDesktop — byte-identical to before) or the mobile tree (ContainersMobile — search
// toolbar + card list + FAB, like Aliments/Recettes); the modals are shared (bottom sheets ≤560px).
type ModalState = { mode: 'add' } | { mode: 'edit'; container: Container } | null;

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function sortRows(rows: Container[], sort: SortKey, dir: 'asc' | 'desc'): Container[] {
  const builtins = rows.filter((c) => c.is_builtin);
  const rest = rows.filter((c) => !c.is_builtin);
  const sign = dir === 'asc' ? 1 : -1;
  rest.sort((a, b) =>
    sort === 'weight'
      ? (a.empty_weight_g - b.empty_weight_g) * sign
      : a.name.localeCompare(b.name, 'fr') * sign,
  );
  return [...builtins, ...rest];
}

export function ContainersPage() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Container | null>(null);
  const isMobile = useIsMobile();

  const list = useContainers();
  const { remove, create } = useContainerMutations();
  const all = useMemo(() => list.data?.data ?? [], [list.data]);
  const editable = all.filter((c) => !c.is_builtin).length;

  const rows = useMemo(() => {
    const query = norm(q.trim());
    const filtered = query ? all.filter((c) => norm(c.name).includes(query)) : all;
    return sortRows(filtered, sort, dir);
  }, [all, q, sort, dir]);

  const onSort = (key: SortKey): void => {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir('asc');
    }
  };

  const common = {
    rows,
    loading: list.isLoading,
    q,
    sort,
    dir,
    onQ: setQ,
    onSort,
    onAdd: () => setModal({ mode: 'add' }),
    onOpen: (c: Container) => setModal({ mode: 'edit', container: c }),
  };

  return (
    <>
      {isMobile ? (
        <ContainersMobile {...common} />
      ) : (
        <ContainersDesktop {...common} count={editable} onDelete={(c) => setDeleteTarget(c)} />
      )}

      {modal && (
        <ContainerModal
          container={modal.mode === 'edit' ? modal.container : null}
          onClose={() => setModal(null)}
          onDelete={(c) => {
            setModal(null);
            setDeleteTarget(c);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          container={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const deleted = deleteTarget; // captured before the confirm clears it
            remove.mutate(deleted.id, {
              // B-261: undo re-creates it. Leftover history is unaffected either way — it froze
              // the container's name and tare as values, never a reference (DECISIONS Gap 13).
              onSuccess: () =>
                notifyUndoable('containerDeleted', () =>
                  create.mutateAsync({
                    name: deleted.name,
                    empty_weight_g: deleted.empty_weight_g,
                  }),
                ),
            });
            setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
