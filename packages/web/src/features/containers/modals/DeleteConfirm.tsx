import { Trans, useTranslation } from 'react-i18next';
import type { Container } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { Modal } from '../../../components/Modal/Modal';
import styles from '../containers.module.css';

// Confirm a free container delete (DECISIONS Gap 13: history froze its value, so deleting
// the catalog row never affects past leftovers).
interface Props {
  container: Container;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirm({ container, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Modal title={t('containers.confirm.title')} size="confirm" mobile="sheet" onClose={onCancel}>
      <div className={styles.modalBody}>
        <p>
          <Trans
            i18nKey="containers.confirm.body"
            values={{ name: container.name }}
            components={{ b: <b /> }}
          />
        </p>
      </div>
      <div className={styles.modalActions}>
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {t('common.remove')}
        </Button>
      </div>
    </Modal>
  );
}
