import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../../components/Modal/Modal';
import { Button } from '../../../../components/Button/Button';

// Styled confirm for deleting a meal from the day (B-074 — design/components/modals.md:
// destructive flows use the shared confirm modal, not a native confirm(); sibling of B-009).
interface Props {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function MealDeleteConfirm({ name, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('meals.meal.deleteTitle')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>{t('meals.meal.deletePrompt', { name })}</p>
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
