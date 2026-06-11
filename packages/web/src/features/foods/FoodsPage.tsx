import { useMemo, useState } from 'react';
import type { Food } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { FoodsDesktop } from './components/FoodsDesktop';
import { FoodsMobile } from './components/FoodsMobile';
import type { SortField } from './components/FoodTable';
import type { MinRating, VisibilityFilter } from './components/FiltersPopover';
import { FoodModal } from './modals/FoodModal';
import { ArchiveConfirm } from './modals/ArchiveConfirm';
import { useFoodMutations, useFoodsList } from './useFoods';
import { useIsMobile } from '../../lib/useIsMobile';

// Aliments page (specifications/screens/food-db.md): owns filter/sort/modal state, fetches via
// TanStack Query (server-side search/filter/sort), and switches between the desktop table
// (FoodsDesktop) and the mobile card list (FoodsMobile, mobile-responsive S7) via useIsMobile().
// It renders; it never computes.
type ModalState = { mode: 'add' } | { mode: 'edit'; food: Food } | null;

interface FilterState {
  q: string;
  minRating: MinRating;
  visibility: VisibilityFilter;
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
}

function buildListParams(s: FilterState) {
  return {
    ...(s.q.trim() ? { q: s.q.trim() } : {}),
    ...(s.minRating > 0 ? { min_rating: s.minRating as 1 | 2 | 3 } : {}),
    ...(s.visibility !== 'all' ? { visibility: s.visibility } : {}),
    ...(s.showArchived ? { include_archived: true } : {}),
    sort: s.sort,
    dir: s.dir,
  };
}

/** Live (non-authoritative) duplicate-name hint; the server returns the real warning. */
function isDuplicateName(foods: Food[], name: string, editingId: string | null): boolean {
  return foods.some(
    (f) =>
      f.id !== editingId &&
      f.archived_at === null &&
      f.name.localeCompare(name, undefined, { sensitivity: 'base' }) === 0,
  );
}

export function FoodsPage() {
  const isMobile = useIsMobile();
  const [q, setQ] = useState('');
  const [minRating, setMinRating] = useState<MinRating>(0);
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<SortField>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<Food | null>(null);

  const list = useFoodsList(buildListParams({ q, minRating, visibility, showArchived, sort, dir }));
  const { archive, restore } = useFoodMutations();
  const foods = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);

  const onSort = (field: SortField): void => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir('asc');
    }
  };

  const editingId = modal?.mode === 'edit' ? modal.food.id : null;
  const isDuplicate = (name: string): boolean => isDuplicateName(foods, name, editingId);

  const common = {
    foods,
    loading: list.isLoading,
    isError: list.isError,
    list,
    q,
    minRating,
    visibility,
    showArchived,
    sort,
    dir,
    onQ: setQ,
    onMinRating: setMinRating,
    onVisibility: setVisibility,
    onShowArchived: setShowArchived,
    onSort,
    onAdd: () => setModal({ mode: 'add' }),
    onOpen: (food: Food) => setModal({ mode: 'edit', food }),
  };

  return (
    <AppShell>
      {isMobile ? (
        <FoodsMobile {...common} />
      ) : (
        <FoodsDesktop
          {...common}
          onArchive={(food) => setArchiveTarget(food)}
          onRestore={(food) => restore.mutate(food.id)}
        />
      )}

      {modal && (
        <FoodModal
          food={modal.mode === 'edit' ? modal.food : null}
          isDuplicate={isDuplicate}
          onClose={() => setModal(null)}
          onArchive={(food) => {
            setModal(null);
            setArchiveTarget(food);
          }}
        />
      )}

      {archiveTarget && (
        <ArchiveConfirm
          food={archiveTarget}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => {
            archive.mutate(archiveTarget.id);
            setArchiveTarget(null);
          }}
        />
      )}
    </AppShell>
  );
}
