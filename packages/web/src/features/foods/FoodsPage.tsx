import { useMemo, useState } from 'react';
import type { Food } from '@macronome/shared';
import { FoodsDesktop } from './components/FoodsDesktop';
import { FoodsMobile } from './components/FoodsMobile';
import { FoodModal } from './modals/FoodModal';
import { ArchiveConfirm } from './modals/ArchiveConfirm';
import { useFoodMutations, useFoodsList } from './useFoods';
import { useFoodsContextMenu } from './useFoodsContextMenu';
import { useFoodsFilters, useSourceFilterOptions } from './useFoodsFilters';
import { useIsMobile } from '../../lib/useIsMobile';

// Aliments page (specifications/screens/food-db.md): owns modal state, fetches via TanStack Query
// (server-side search/filter/sort), and switches between the desktop table (FoodsDesktop) and the
// mobile card list (FoodsMobile, mobile-responsive S7) via useIsMobile(). It renders; it never
// computes. The filter/sort state and the params it produces live in useFoodsFilters.
type ModalState = { mode: 'add' } | { mode: 'edit'; food: Food } | null;

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
  const filters = useFoodsFilters();
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<Food | null>(null);

  const list = useFoodsList(filters.params);
  const { archive, restore } = useFoodMutations();
  const foods = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  // Read from the newest page: every page of one query reports the same `total` (B-278) and the
  // same `sources` (B-295), and the newest is the freshest. Undefined until page 1 lands, so the
  // toolbar shows nothing rather than a number that would immediately change.
  const latest = list.data?.pages.at(-1);
  const sourceOptions = useSourceFilterOptions(latest?.sources);

  const editingId = modal?.mode === 'edit' ? modal.food.id : null;
  const isDuplicate = (name: string): boolean => isDuplicateName(foods, name, editingId);
  const openFood = (food: Food): void => setModal({ mode: 'edit', food });
  // Installed-window right-click menu on food rows (B-195).
  useFoodsContextMenu(foods, openFood, setArchiveTarget, (f) => restore.mutate(f.id));

  const common = {
    foods,
    total: latest?.total,
    loading: list.isLoading,
    isError: list.isError,
    list,
    ...filters.state,
    sourceOptions,
    ...filters.handlers,
    onAdd: () => setModal({ mode: 'add' }),
    onOpen: openFood,
  };

  return (
    <>
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
          presentSources={latest?.sources ?? []}
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
    </>
  );
}
