import type { RecipeBulkPatch, RecipeSummary } from '@macronome/shared';
import { RecipeBuilderModal } from '../modals/RecipeBuilderModal';
import { RecipeArchiveConfirm } from '../modals/RecipeArchiveConfirm';
import { RecipeBulkModal } from '../modals/RecipeBulkModal';

// The three overlays of the Recettes screen — builder, batch popup, archive confirm — extracted
// from `RecipesPage` when BE-1/B-308 added the third, so the page stays inside the per-function
// line cap. Pure switch: it owns no state, the page still does.

export type RecipesModalState =
  | { mode: 'add' }
  | { mode: 'edit'; id: string }
  // B-329: the batch popup carries the ids it was opened on — see FoodsPage for the race.
  | { mode: 'bulk'; ids: string[] }
  | null;

interface Props {
  modal: RecipesModalState;
  archiveTarget: RecipeSummary | null;
  onCloseModal: () => void;
  onApplyBulk: (ids: string[], patch: RecipeBulkPatch) => void;
  onArchiveTarget: (recipe: RecipeSummary | null) => void;
  onConfirmArchive: () => void;
}

export function RecipesModals(props: Props) {
  const { modal, archiveTarget } = props;
  return (
    <>
      {modal?.mode === 'bulk' && (
        <RecipeBulkModal
          count={modal.ids.length}
          onClose={props.onCloseModal}
          onApply={(patch) => props.onApplyBulk(modal.ids, patch)}
        />
      )}

      {modal && modal.mode !== 'bulk' && (
        <RecipeBuilderModal
          recipeId={modal.mode === 'edit' ? modal.id : null}
          onClose={props.onCloseModal}
          onArchive={(recipe) => {
            props.onCloseModal();
            props.onArchiveTarget(recipe);
          }}
        />
      )}

      {archiveTarget && (
        <RecipeArchiveConfirm
          recipe={archiveTarget}
          onCancel={() => props.onArchiveTarget(null)}
          onConfirm={props.onConfirmArchive}
        />
      )}
    </>
  );
}
