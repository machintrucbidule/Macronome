import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../../components/Modal/Modal';
import { Button } from '../../../../components/Button/Button';

// Strong confirm for Complet -> Partiel on a day that carries food (DK-1 / B-078 —
// design/components/modals.md: destructive flows use the shared confirm modal). Converting
// discards the day's meal lines and keeps only the current calorie total; the server does it.
interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConvertToSummaryConfirm({ onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('meals.convertSummary.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>{t('meals.convertSummary.prompt')}</p>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('meals.convertSummary.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
