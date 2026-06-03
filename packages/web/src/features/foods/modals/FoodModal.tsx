import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { FoodModalFields } from './FoodModalFields';
import { draftToBody, initialDraft, type Draft } from './draft';
import { useFoodMutations } from '../useFoods';

// Food add/edit modal shell (specifications/screens/food-db.md, modals.md). Editing
// macros affects future logs only (server freezes history). The duplicate-name hint
// is a live client heuristic; the server returns the authoritative `duplicate_name`
// warning on save (non-blocking). The body fields live in FoodModalFields.
interface FoodModalProps {
  food: Food | null;
  isDuplicate: (name: string) => boolean;
  onClose: () => void;
  onArchive: (food: Food) => void;
}

export function FoodModal({ food, isDuplicate, onClose, onArchive }: FoodModalProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(food));
  const { create, update } = useFoodMutations();
  const set = (patch: Partial<Draft>): void => setDraft((d) => ({ ...d, ...patch }));

  const isEdit = food !== null;
  const trimmedName = draft.name.trim();
  const showDup = trimmedName.length > 0 && isDuplicate(trimmedName);
  const pending = create.isPending || update.isPending;

  const save = (): void => {
    if (!trimmedName) return;
    const body = draftToBody(draft);
    if (isEdit) update.mutate({ id: food.id, body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  return (
    <Modal title={t(isEdit ? 'foods.modal.editTitle' : 'foods.modal.addTitle')} onClose={onClose}>
      <div className={modalStyles.sub}>{t('foods.modal.sub')}</div>
      <div className={modalStyles.body}>
        <FoodModalFields draft={draft} isEdit={isEdit} showDup={showDup} set={set} />
      </div>

      <div className={modalStyles.actions}>
        {isEdit && food.archived_at === null ? (
          <Button variant="danger" onClick={() => onArchive(food)}>
            {t('foods.archive')}
          </Button>
        ) : (
          <span />
        )}
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save} disabled={pending || !trimmedName}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
