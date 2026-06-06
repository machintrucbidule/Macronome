import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';

// Styled confirm for "Tout effacer" (B-046 — design/components/modals.md: destructive flows
// use the shared confirm modal, not a native confirm()). The clear itself runs server-side.
interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ClearDayConfirm({ onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('meals.clear.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>{t('meals.clear.prompt')}</p>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('meals.clear.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
