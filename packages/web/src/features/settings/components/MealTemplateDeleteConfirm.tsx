import { Trans, useTranslation } from 'react-i18next';
import type { MealTemplateItem as Item } from '@macronome/shared';
import { Modal, modalStyles } from '../../../components/Modal/Modal';
import { Button } from '../../../components/Button/Button';

// Styled confirm for removing a default-meal template row (B-009 — design/components/
// modals.md: destructive flows use the shared confirm modal, not a native confirm()).
interface Props {
  item: Item;
  onCancel: () => void;
  onConfirm: () => void;
}

export function MealTemplateDeleteConfirm({ item, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('settings.template.deleteTitle')} size="confirm" onClose={onCancel}>
      <div className={modalStyles.body}>
        <Trans
          i18nKey="settings.template.deletePrompt"
          values={{ name: item.name }}
          components={{ b: <b /> }}
        />
      </div>
      <div className={modalStyles.actions}>
        <span />
        <div className={modalStyles.actionsRight}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('settings.template.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
