import { Trans, useTranslation } from 'react-i18next';
import type { AdminUser } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { Modal } from '../../../components/Modal/Modal';
import styles from '../users.module.css';

// Simple confirm for a role change (owner decision, screens/users.md): reversible
// but access-sensitive, so a misclick guard — not a typed confirmation.
interface Props {
  user: AdminUser;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RoleConfirm({ user, pending, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
  const promote = !user.is_admin;
  return (
    <Modal title={t('users.roleConfirm.title')} size="confirm" onClose={onCancel}>
      <div className={styles.modalBody}>
        <p>
          <Trans
            i18nKey={promote ? 'users.roleConfirm.promoteBody' : 'users.roleConfirm.demoteBody'}
            values={{ name: user.username }}
            components={{ b: <b /> }}
          />
        </p>
      </div>
      <div className={styles.modalActions}>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {t('common.cancel')}
        </Button>
        <Button variant={promote ? 'primary' : 'danger'} onClick={onConfirm} disabled={pending}>
          {t(promote ? 'users.promote' : 'users.demote')}
        </Button>
      </div>
    </Modal>
  );
}
