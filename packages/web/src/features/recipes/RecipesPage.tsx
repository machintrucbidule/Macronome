import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { AppShell } from '../../app/AppShell';
import { EmptyState } from '../../components/states/EmptyState';
import { SkeletonRows } from '../../components/states/SkeletonRows';
import { RecipesToolbar } from './components/RecipesToolbar';
import { RecipesTable, type SortField } from './components/RecipesTable';
import type { MinRating } from './components/FiltersPopover';
import { RecipeBuilderModal } from './modals/RecipeBuilderModal';
import { RecipeArchiveConfirm } from './modals/RecipeArchiveConfirm';
import { useRecipeMutations, useRecipesList } from './useRecipes';

// Recettes page (specifications/screens/recipe.md): owns search/filter/sort/modal state,
// fetches via TanStack Query (server-side search/filter/sort), and renders the table +
// builder + archive confirm. It renders; it never computes (derived figures come from the API).
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
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [minRating, setMinRating] = useState<MinRating>(0);
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<SortField>('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [modal, setModal] = useState<ModalState>(null);
  const [archiveTarget, setArchiveTarget] = useState<RecipeSummary | null>(null);

  const list = useRecipesList(buildListParams({ q, minRating, showArchived, sort, dir }));
  const { archive, restore } = useRecipeMutations();
  const recipes = useMemo(() => list.data?.data ?? [], [list.data]);

  const onSort = (field: SortField): void => {
    if (field === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(field);
      setDir('asc');
    }
  };

  return (
    <AppShell>
      <RecipesToolbar
        count={recipes.length}
        q={q}
        minRating={minRating}
        showArchived={showArchived}
        onQ={setQ}
        onMinRating={setMinRating}
        onShowArchived={setShowArchived}
        onAdd={() => setModal({ mode: 'add' })}
      />

      {list.isLoading ? (
        <SkeletonRows />
      ) : recipes.length === 0 ? (
        <EmptyState>{t('recipes.empty')}</EmptyState>
      ) : (
        <RecipesTable
          recipes={recipes}
          sort={sort}
          dir={dir}
          onSort={onSort}
          onOpen={(recipe) => setModal({ mode: 'edit', id: recipe.id })}
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
