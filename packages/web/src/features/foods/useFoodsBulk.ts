import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { FoodBulkPatch } from '@macronome/shared';
import { foodsApi, type FoodListParams } from '../../api/foods';
import { notifyUndoable } from '../../components/Toast/notify';
import { useIdSelection, type IdSelection } from '../../lib/useIdSelection';

// Batch selection + batch write for "Mes aliments" (BE-1).
//
// The header checkbox cannot be answered client-side: the list holds one 50-row page at a time, so
// "everything matching the filter" is a server round trip (`GET /foods/ids`). What comes back is
// **frozen** (D10) — rows stay individually un-tickable, and what gets written is what the count
// promised, even if the catalogue changed meanwhile.

export interface FoodsBulk {
  selection: IdSelection;
  /** Header checkbox: true → select the whole filtered set, false → clear. */
  selectAll: (checked: boolean) => void;
  /** Apply a patch to the selection, then offer Annuler. The selection SURVIVES (owner), so a
   *  second field can be applied to the same set without re-ticking. */
  apply: (patch: FoodBulkPatch) => void;
}

export function useFoodsBulk(params: FoodListParams): FoodsBulk {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['foods'] });
  // The selection belongs to the filter it was made under; the sort is deliberately not part of
  // the key, since re-ordering the same rows does not invalidate a set of ids.
  const { sort: _sort, dir: _dir, ...filters } = params;
  const selection = useIdSelection(JSON.stringify(filters));

  const selectAllMutation = useMutation({
    mutationFn: () => foodsApi.ids(filters),
    onSuccess: (res) => selection.setAll(res.data),
  });

  const applyMutation = useMutation({
    mutationFn: (patch: FoodBulkPatch) =>
      foodsApi.bulkUpdate({ ids: [...selection.selected], patch }),
    onSuccess: () => {
      void invalidate();
      notifyUndoable('foodsBulkEdited', async () => {
        await foodsApi.bulkUndo();
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
    apply: (patch) => applyMutation.mutate(patch),
  };
}
