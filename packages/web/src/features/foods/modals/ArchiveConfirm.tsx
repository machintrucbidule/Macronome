import { useTranslation, Trans } from 'react-i18next';
import type { Food } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';

// Archive confirmation (specifications/screens/food-db.md): soft delete — the food
// leaves search/list but stays in history and the pantry, and can be restored.
interface ArchiveConfirmProps {
  food: Food;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ArchiveConfirm({ food, onCancel, onConfirm }: ArchiveConfirmProps) {
  const { t } = useTranslation();
  return (
    <Modal title={t('foods.confirm.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>
          <Trans
            i18nKey="foods.confirm.body"
            values={{ name: food.name }}
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
            {t('foods.archive')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
