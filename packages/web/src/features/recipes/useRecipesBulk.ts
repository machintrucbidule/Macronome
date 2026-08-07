import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RecipeBulkPatch } from '@macronome/shared';
import { recipesApi, type RecipeListParams } from '../../api/recipes';
import { notifyUndoable } from '../../components/Toast/notify';
import { useIdSelection, type IdSelection } from '../../lib/useIdSelection';

// Batch selection + batch write for Recettes (BE-1/B-308) — the twin of `useFoodsBulk.ts`. The
// patch carries the rating alone; see `spec/api/foods-recipes.md` §Recipes for why the other
// editable values are out of scope.

export interface RecipesBulk {
  selection: IdSelection;
  selectAll: (checked: boolean) => void;
  /** Applies to the ids the recap counted, passed in rather than read live — see useFoodsBulk (B-329). */
  apply: (ids: string[], patch: RecipeBulkPatch) => void;
}

export function useRecipesBulk(params: RecipeListParams): RecipesBulk {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['recipes'] });
  // The sort is deliberately not part of the key: re-ordering the same rows does not invalidate
  // a set of ids (see `useIdSelection`).
  const { sort: _sort, dir: _dir, ...filters } = params;
  const selection = useIdSelection(JSON.stringify(filters));

  const selectAllMutation = useMutation({
    mutationFn: () => recipesApi.ids(filters),
    onSuccess: (res) => selection.setAll(res.data),
  });

  const applyMutation = useMutation({
    mutationFn: (vars: { ids: string[]; patch: RecipeBulkPatch }) => recipesApi.bulkUpdate(vars),
    onSuccess: () => {
      void invalidate();
      notifyUndoable('recipesBulkEdited', async () => {
        await recipesApi.bulkUndo();
        await invalidate();
      });
    },
  });

  return {
    selection,
    selectAll: (checked) => {
      if (checked) selectAllMutation.mutate();
      else selection.clear();
    },
    // An empty set is not a write: the API answers 422 and the screen would report nothing.
    apply: (ids, patch) => {
      if (ids.length > 0) applyMutation.mutate({ ids, patch });
    },
  };
}
