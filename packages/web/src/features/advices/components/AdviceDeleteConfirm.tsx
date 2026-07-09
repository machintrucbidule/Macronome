import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';

// Styled confirm for deleting an archived advice (B-213, specifications/screens/conseils.md block D:
// destructive flows use the shared confirm modal, not a native confirm(); mirrors MealDeleteConfirm).
interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

export function AdviceDeleteConfirm({ onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('advices.deleteTitle')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>{t('advices.deletePrompt')}</p>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('common.remove')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
