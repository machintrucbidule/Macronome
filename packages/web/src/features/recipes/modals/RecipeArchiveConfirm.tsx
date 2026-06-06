import { Trans, useTranslation } from 'react-i18next';
import type { RecipeSummary } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';

// Archive confirmation (specifications/screens/recipe.md): soft delete — the recipe leaves
// search/list but stays in the history of meals that used it, and can be restored.
interface RecipeArchiveConfirmProps {
  recipe: RecipeSummary;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RecipeArchiveConfirm({ recipe, onCancel, onConfirm }: RecipeArchiveConfirmProps) {
  const { t } = useTranslation();
  return (
    <Modal title={t('recipes.confirm.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>
          <Trans
            i18nKey="recipes.confirm.body"
            values={{ name: recipe.name }}
            components={{ b: <b /> }}
          />
        </p>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('recipes.archive')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
