import { useTranslation } from 'react-i18next';
import { Modal, modalStyles } from '../../../../components/Modal/Modal';
import { Button } from '../../../../components/Button/Button';

// Confirm for "Copier le repas de la veille" (CP-2 / B-248). Mounted **only when the target
// meal already has lines** — an empty meal copies in one click, the deliberate divergence from
// the always-confirming day-level copy (design/components/modals.md §Conditional confirmation).
interface Props {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CopyMealConfirm({ name, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('meals.copyMeal.title')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <p className={modalStyles.text}>{t('meals.copyMeal.prompt', { name })}</p>
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {t('meals.copyMeal.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
