import { useTranslation } from 'react-i18next';
import type { WeighIn } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';
import { useWeightMutations, weighInRestoreBody } from '../useWeight';
import { notifyUndoable } from '../../../components/Toast/notify';

// Styled confirm for the context menu's "Supprimer la pesée" (B-195 — destructive flows
// use the shared confirm modal, like MealDeleteConfirm/B-074). Deletes directly through
// the existing weight mutation (its onSuccess re-derives the periods via invalidation);
// the modal-based delete inside WeighInModal is unchanged.
interface Props {
  weighIn: WeighIn;
  onClose: () => void;
}

export function WeighInDeleteConfirm({ weighIn, onClose }: Props) {
  const { t } = useTranslation();
  const { remove, create } = useWeightMutations();
  const confirm = (): void => {
    void remove
      .mutateAsync(weighIn.id)
      .then(() => {
        // B-261: undo re-creates the weigh-in from every field it carried. It can fail with
        // 409 weigh_in_date_occupied if that date was refilled meanwhile — notifyUndoable says so.
        notifyUndoable('weightDeleted', () => create.mutateAsync(weighInRestoreBody(weighIn)));
      })
      .finally(onClose);
  };
  return (
    <Modal title={t('contextMenu.deleteWeighInTitle')} size="confirm" onClose={onClose}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>
          {t('contextMenu.deleteWeighInPrompt', { date: weighIn.date })}
        </p>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onClose} disabled={remove.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={remove.isPending}>
            {t('common.remove')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
