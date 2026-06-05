import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Container } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { EmptyState } from '../../components/states/EmptyState';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { ContainerTable, type SortKey } from './components/ContainerTable';
import { ContainersToolbar } from './components/ContainersToolbar';
import { ContainerModal } from './modals/ContainerModal';
import { DeleteConfirm } from './modals/DeleteConfirm';
import { useContainerMutations, useContainers } from './useContainers';
import styles from './containers.module.css';

// Contenants screen (specifications/screens/containers.md): the tare catalog. Search +
// sort are client-side over the full list; the built-in "Rien" stays pinned first and
// locked. Add/edit via modal; free delete with a confirm. It renders; it never computes.
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
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Container | null>(null);

  const list = useContainers();
  const { remove } = useContainerMutations();
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

  return (
    <AppShell>
      <div className={styles.wrap}>
        <div className={styles.crumb}>{t('containers.crumb')}</div>
        <ContainersToolbar
          count={editable}
          q={q}
          onQ={setQ}
          onAdd={() => setModal({ mode: 'add' })}
        />
        <p className={styles.lead}>{t('containers.lead')}</p>

        {list.isLoading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <EmptyState>{t('containers.empty')}</EmptyState>
        ) : (
          <ContainerTable
            rows={rows}
            sort={sort}
            dir={dir}
            onSort={onSort}
            onEdit={(c) => setModal({ mode: 'edit', container: c })}
            onDelete={(c) => setDeleteTarget(c)}
          />
        )}
      </div>

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
            remove.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }}
        />
      )}
    </AppShell>
  );
}
