import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../../lib/useDebouncedValue';
import { useQueryClient } from '@tanstack/react-query';
import type { Food, FoodRef } from '@macronome/shared';
import { FoodsModeToggle, type FoodsMode } from './components/FoodsModeToggle';
import { LibraryView } from './components/LibraryView';
import { CatalogView } from './catalog/CatalogView';
import { FOOD_REFS_KEY } from './catalog/useFoodRefs';
import { FoodModal } from './modals/FoodModal';
import { FoodBulkModal } from './modals/FoodBulkModal';
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
  // B-329: the batch popup carries the ids it was opened on. Reading the live selection at write
  // time was a race — a filter change clears the selection by design, and if that landed while
  // the popup was open the write went out with `ids: []` and was rejected 422, silently.
  | { mode: 'bulk'; ids: string[] }
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

/** Which modal the batch button opens (BE-1): one selected food gets the ordinary form — a reduced
 *  form for a single row would be a worse form — and two or more get the batch popup. */
function bulkModalFor(selected: Set<string>, foods: Food[]): ModalState {
  const ids = [...selected];
  const only = ids.length === 1 ? foods.find((f) => f.id === ids[0]) : undefined;
  return only ? { mode: 'edit', food: only } : { mode: 'bulk', ids };
}

export function FoodsPage() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  const [mode, setMode] = useState<FoodsMode>('library');
  const [q, setQ] = useState('');
  // The field stays instant; the QUERY waits 300 ms (LD-1/B-303, the delay useChronoSearch
  // already uses). Every keystroke used to discard every accumulated page and restart the list.
  const debouncedQ = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<Food | null>(null);

  const library = useFoodsLibrary(debouncedQ);
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
          onBulkEdit={() => setModal(bulkModalFor(library.bulk.selection.selected, library.foods))}
        />
      ) : (
        <CatalogView
          q={q}
          queryQ={debouncedQ}
          onQ={setQ}
          modeToggle={modeToggle}
          onAdd={() => setModal({ mode: 'add' })}
          onAdopt={(ref) => setModal({ mode: 'adopt', ref })}
        />
      )}

      {modal?.mode === 'bulk' && (
        <FoodBulkModal
          count={modal.ids.length}
          presentSources={library.sources}
          onClose={() => setModal(null)}
          onApply={(patch) => {
            library.bulk.apply(modal.ids, patch);
            setModal(null); // the selection itself survives (owner), so a second field can follow
          }}
        />
      )}

      {modal && modal.mode !== 'bulk' && (
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
