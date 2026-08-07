import { useState } from 'react';
import type { RecipeSummary } from '@macronome/shared';
import { RecipesDesktop } from './components/RecipesDesktop';
import { RecipesMobile } from './components/RecipesMobile';
import type { SortField } from './components/RecipesTable';
import type { MinRating } from './components/FiltersPopover';
import { RecipesModals, type RecipesModalState } from './components/RecipesModals';
import { useRecipeMutations, useRecipesList } from './useRecipes';
import { useRecipesBulk } from './useRecipesBulk';
import { useRecipesContextMenu } from './useRecipesContextMenu';
import { defaultDirFor } from '../../components/DataTable/sortDir';
import { useIsMobile } from '../../lib/useIsMobile';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from '../../lib/useDebouncedValue';

// Recettes page (specifications/screens/recipe.md): owns search/filter/sort/modal state,
// fetches via TanStack Query (server-side search/filter/sort), and renders the desktop table or
// the mobile card list (useIsMobile render-switch, S6) + the shared builder / archive confirm.
// It renders; it never computes (derived figures come from the API).
type ModalState = RecipesModalState;

/** Columns that start descending on a first click (B-299): every numeric one. */
export const RECIPES_DESC_FIRST: ReadonlySet<SortField> = new Set<SortField>([
  'kcal',
  'fat',
  'carb',
  'protein',
  'batch',
  'servings',
  'weight_per_portion',
  'rating',
]);

interface FilterState {
  q: string;
  minRating: MinRating;
  showArchived: boolean;
  sort: SortField;
  dir: 'asc' | 'desc';
}

function buildListParams(s: FilterState) {
  return {
    ...(s.q.trim() ? { q: s.q.trim() } : {}),
    ...(s.minRating > 0 ? { min_rating: s.minRating as 1 | 2 | 3 } : {}),
    ...(s.showArchived ? { include_archived: true } : {}),
    sort: s.sort,
    dir: s.dir,
  };
}

export function RecipesPage() {
  const isMobile = useIsMobile();
  const [q, setQ] = useState('');
  const [minRating, setMinRating] = useState<MinRating>(0);
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<SortField>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<RecipeSummary | null>(null);

  // The field stays instant; the query waits 300 ms (LD-1/B-303) — see FoodsPage.
  const debouncedQ = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const params = buildListParams({ q: debouncedQ, minRating, showArchived, sort, dir });
  const list = useRecipesList(params);
  // Batch selection (BE-1/B-308), built from the SAME params — that is what keeps "select
  // everything matching the filter" honest.
  const bulk = useRecipesBulk(params);
  const { archive, restore } = useRecipeMutations();
  const recipes = list.rows;
  // Rows matching the current filters, server-side (B-278). Read from whichever page answered —
  // since B-303 a scrollbar jump asks for the page under the thumb before page 1.
  const total = list.total;

  // Same field → flip the direction; a new field starts in its useful direction (B-299).
  const onSort = (field: SortField): void => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir(defaultDirFor(field, RECIPES_DESC_FIRST));
    }
  };

  // Installed-window right-click menu on recipe rows (B-195).
  useRecipesContextMenu({
    recipes,
    onOpen: (recipe) => setModal({ mode: 'edit', id: recipe.id }),
    onArchive: (recipe) => setArchiveTarget(recipe),
    onRestore: (recipe) => restore.mutate(recipe.id),
  });

  // Props shared by both presentations (the desktop table and the mobile card list consume the
  // same server-side state + handlers); desktop adds the per-row archive/restore actions.
  const common = {
    recipes,
    total,
    loading: list.loading,
    list,
    q,
    minRating,
    showArchived,
    sort,
    dir,
    onQ: setQ,
    onMinRating: setMinRating,
    onShowArchived: setShowArchived,
    onSort,
    onAdd: () => setModal({ mode: 'add' }),
    onOpen: (recipe: RecipeSummary) => setModal({ mode: 'edit', id: recipe.id }),
    bulk,
    // One selected recipe opens the ordinary builder; two or more the batch popup (BE-1).
    onBulkEdit: (): void => {
      const ids = [...bulk.selection.selected];
      setModal(ids.length === 1 ? { mode: 'edit', id: ids[0] as string } : { mode: 'bulk', ids });
    },
  };

  return (
    <>
      {isMobile ? (
        // Mobile (≤560px): card list + shared list chrome + FAB → bottom-sheet builder (S6).
        <RecipesMobile {...common} />
      ) : (
        // Desktop (≥561px): the untouched toolbar + dense table — byte-identical to before.
        <RecipesDesktop
          {...common}
          onArchive={(recipe) => setArchiveTarget(recipe)}
          onRestore={(recipe) => restore.mutate(recipe.id)}
        />
      )}

      <RecipesModals
        modal={modal}
        archiveTarget={archiveTarget}
        onCloseModal={() => setModal(null)}
        onApplyBulk={(ids, patch) => {
          bulk.apply(ids, patch);
          setModal(null); // the selection itself survives (owner)
        }}
        onArchiveTarget={setArchiveTarget}
        onConfirmArchive={() => {
          if (archiveTarget) archive.mutate(archiveTarget.id);
          setArchiveTarget(null);
        }}
      />
    </>
  );
}
