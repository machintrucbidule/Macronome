import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';

// Styled confirm for "Copier hier" (B-082 — design/components/modals.md: a flow that
// overwrites the current day uses the shared confirm modal, not a native confirm()). The
// copy itself runs server-side; an empty source surfaces as the meals.copyEmpty banner.
interface Props {
  onCancel: () => void;
  onConfirm: () => void;
}

export function CopyYesterdayConfirm({ onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('meals.copy.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>{t('meals.copy.prompt')}</p>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {t('meals.copy.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
