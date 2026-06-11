import { useMemo, useState } from 'react';
import type { RecipeSummary } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { RecipesDesktop } from './components/RecipesDesktop';
import { RecipesMobile } from './components/RecipesMobile';
import type { SortField } from './components/RecipesTable';
import type { MinRating } from './components/FiltersPopover';
import { RecipeBuilderModal } from './modals/RecipeBuilderModal';
import { RecipeArchiveConfirm } from './modals/RecipeArchiveConfirm';
import { useRecipeMutations, useRecipesList } from './useRecipes';
import { useIsMobile } from '../../lib/useIsMobile';

// Recettes page (specifications/screens/recipe.md): owns search/filter/sort/modal state,
// fetches via TanStack Query (server-side search/filter/sort), and renders the desktop table or
// the mobile card list (useIsMobile render-switch, S6) + the shared builder / archive confirm.
// It renders; it never computes (derived figures come from the API).
type ModalState = { mode: 'add' } | { mode: 'edit'; id: string } | null;

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

  const list = useRecipesList(buildListParams({ q, minRating, showArchived, sort, dir }));
  const { archive, restore } = useRecipeMutations();
  const recipes = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);

  const onSort = (field: SortField): void => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir('asc');
    }
  };

  // Props shared by both presentations (the desktop table and the mobile card list consume the
  // same server-side state + handlers); desktop adds the per-row archive/restore actions.
  const common = {
    recipes,
    loading: list.isLoading,
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
  };

  return (
    <AppShell>
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

      {modal && (
        <RecipeBuilderModal
          recipeId={modal.mode === 'edit' ? modal.id : null}
          onClose={() => setModal(null)}
          onArchive={(recipe) => {
            setModal(null);
            setArchiveTarget(recipe);
          }}
        />
      )}

      {archiveTarget && (
        <RecipeArchiveConfirm
          recipe={archiveTarget}
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
