import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { ApiError } from '../../../api/client';
import { BuilderFields } from './BuilderFields';
import { draftToBody, emptyRecipeDraft, initialRecipeDraft, type RecipeDraft } from './draft';
import { useRecipe, useRecipeMutations, useRecipePreview } from '../useRecipes';

// Recipe builder popup (specifications/screens/recipe.md): name, ingredient block, yield
// panel, instructions. Derived figures come from the server; the transitive cycle guard is
// enforced server-side (a 422 surfaces here as a banner). Edits recompute the derived food
// going forward; past meal_entry snapshots stay frozen.
interface RecipeBuilderModalProps {
  recipeId: string | null;
  onClose: () => void;
  onArchive: (recipe: RecipeSummary) => void;
}

export function RecipeBuilderModal({ recipeId, onClose, onArchive }: RecipeBuilderModalProps) {
  const { t } = useTranslation();
  const isEdit = recipeId !== null;
  const loaded = useRecipe(recipeId);
  const full = loaded.data?.data ?? null;
  const [draft, setDraft] = useState<RecipeDraft>(emptyRecipeDraft);
  const [hydrated, setHydrated] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);
  const { create, update } = useRecipeMutations();
  const preview = useRecipePreview(draft);

  useEffect(() => {
    if (isEdit && full && !hydrated) {
      setDraft(initialRecipeDraft(full));
      setHydrated(true);
    }
  }, [isEdit, full, hydrated]);

  const set = (patch: Partial<RecipeDraft>): void => setDraft((d) => ({ ...d, ...patch }));
  const name = draft.name.trim();
  const canSave = name.length > 0 && draft.ingredients.length > 0;
  const pending = create.isPending || update.isPending;

  const save = (): void => {
    if (!canSave) return;
    setError(null);
    const body = draftToBody(draft);
    const onError = (e: unknown): void => setError(e instanceof ApiError ? e.code : 'error');
    if (isEdit) update.mutate({ id: recipeId, body }, { onSuccess: onClose, onError });
    else create.mutate(body, { onSuccess: onClose, onError });
  };

  const title = t(isEdit ? 'recipes.modal.editTitle' : 'recipes.modal.addTitle');
  if (isEdit && !hydrated) {
    return (
      <Modal title={title} onClose={onClose}>
        <div className={modalStyles.body}>{t('common.loading')}</div>
      </Modal>
    );
  }

  return (
    <Modal title={title} size="wide" onClose={onClose}>
      <div className={modalStyles.body}>
        <BuilderFields draft={draft} full={full} preview={preview.data} error={error} set={set} />
      </div>

      <div className={modalStyles.actions}>
        {isEdit && full && full.archived_at === null ? (
          <Button variant="danger" onClick={() => onArchive(full)}>
            {t('recipes.archive')}
          </Button>
        ) : (
          <span />
        )}
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={pending || !canSave}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
