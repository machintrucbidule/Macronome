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
  // Mobile-only Modal variant (S6): the builder opens full-screen ≤560px. Inert on desktop —
  // Modal applies the variant only when its own useIsMobile() is true (so desktop stays `wide`).
  mobile?: 'fullscreen' | 'sheet';
}

// Footer left action: archive (active recipe), restore (archived recipe), or nothing
// (add mode / not yet loaded). Extracted to keep the modal's complexity in check.
function FooterLeftAction({
  full,
  onArchive,
  onRestore,
}: {
  full: RecipeSummary | null;
  onArchive: (recipe: RecipeSummary) => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  if (!full) return <span />;
  if (full.archived_at === null)
    return (
      <Button variant="danger" onClick={() => onArchive(full)}>
        {t('recipes.archive')}
      </Button>
    );
  return (
    <Button variant="ghost" onClick={onRestore}>
      {t('recipes.restore')}
    </Button>
  );
}

export function RecipeBuilderModal({
  recipeId,
  onClose,
  onArchive,
  mobile,
}: RecipeBuilderModalProps) {
  const { t } = useTranslation();
  const isEdit = recipeId !== null;
  const loaded = useRecipe(recipeId);
  const full = loaded.data?.data ?? null;
  const [draft, setDraft] = useState<RecipeDraft>(emptyRecipeDraft);
  const [hydrated, setHydrated] = useState(!isEdit);
  const [error, setError] = useState<string | null>(null);
  const { create, update, restore } = useRecipeMutations();
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
      <Modal title={title} {...(mobile ? { mobile } : {})} onClose={onClose}>
        <div className={modalStyles.body}>{t('common.loading')}</div>
      </Modal>
    );
  }

  return (
    <Modal title={title} size="wide" {...(mobile ? { mobile } : {})} onClose={onClose}>
      <div className={modalStyles.body}>
        <BuilderFields draft={draft} full={full} preview={preview.data} error={error} set={set} />
      </div>

      <div className={modalStyles.actions}>
        <FooterLeftAction
          full={full}
          onArchive={onArchive}
          onRestore={() => full && restore.mutate(full.id, { onSuccess: onClose })}
        />
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
