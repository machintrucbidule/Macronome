import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { Food, FoodRef } from '@macronome/shared';
import { FoodsModeToggle, type FoodsMode } from './components/FoodsModeToggle';
import { LibraryView } from './components/LibraryView';
import { CatalogView } from './catalog/CatalogView';
import { FOOD_REFS_KEY } from './catalog/useFoodRefs';
import { FoodModal } from './modals/FoodModal';
import { ArchiveConfirm } from './modals/ArchiveConfirm';
import { ciqualPatch } from './modals/draft';
import { useFoodMutations } from './useFoods';
import { useFoodsContextMenu } from './useFoodsContextMenu';
import { useFoodsLibrary } from './useFoodsFilters';

// Aliments page (specifications/screens/food-db.md). Two modes since B-292 — the user's own
// foods and the read-only Ciqual catalog — so the page owns only what both share: the mode, the
// search text (kept across a switch), and the food form. Each view owns its filters and query.
type ModalState =
  | { mode: 'add' }
  | { mode: 'edit'; food: Food }
  | { mode: 'adopt'; ref: FoodRef }
  | null;

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
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const [mode, setMode] = useState<FoodsMode>('library');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<Food | null>(null);

  const library = useFoodsLibrary(q);
  const { archive, restore } = useFoodMutations();

  const editingId = modal?.mode === 'edit' ? modal.food.id : null;
  const openFood = (food: Food): void => setModal({ mode: 'edit', food });
  // Installed-window right-click menu on food rows (B-195).
  useFoodsContextMenu(library.foods, openFood, setArchiveTarget, (f) => restore.mutate(f.id));

  const closeModal = (): void => {
    // An adoption changes which catalog rows read "déjà ajouté", so the catalog must refetch.
    if (modal?.mode === 'adopt') void qc.invalidateQueries({ queryKey: FOOD_REFS_KEY });
    setModal(null);
  };

  const modeToggle = <FoodsModeToggle mode={mode} onMode={setMode} />;

  return (
    <>
      {mode === 'library' ? (
        <LibraryView
          library={library}
          q={q}
          onQ={setQ}
          modeToggle={modeToggle}
          onAdd={() => setModal({ mode: 'add' })}
          onOpen={openFood}
          onArchive={(food) => setArchiveTarget(food)}
          onRestore={(food) => restore.mutate(food.id)}
        />
      ) : (
        <CatalogView
          q={q}
          onQ={setQ}
          modeToggle={modeToggle}
          onAdd={() => setModal({ mode: 'add' })}
          onAdopt={(ref) => setModal({ mode: 'adopt', ref })}
        />
      )}

      {modal && (
        <FoodModal
          food={modal.mode === 'edit' ? modal.food : null}
          {...(modal.mode === 'adopt' ? { prefill: ciqualPatch(modal.ref, i18n.language) } : {})}
          presentSources={library.sources}
          isDuplicate={(name) => isDuplicateName(library.foods, name, editingId)}
          onClose={closeModal}
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
