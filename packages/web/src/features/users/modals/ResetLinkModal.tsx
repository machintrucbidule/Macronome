import { Trans, useTranslation } from 'react-i18next';
import type { AdminUser, CreatedToken } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { Modal } from '../../../components/Modal/Modal';
import { TokenLinkField } from '../components/TokenLinkField';
import { tokenUrl } from '../useTokens';
import styles from '../users.module.css';

// Reset-link display (screens/users.md, B-194). The link was created by the row
// action (replacing the account's pending one); shown once, copy at hand.
export function ResetLinkModal({
  user,
  link,
  onClose,
}: {
  user: AdminUser;
  link: CreatedToken;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal title={t('users.resetModal.title')} size="confirm" onClose={onClose}>
      <div className={styles.modalBody}>
        <p>
          <Trans
            i18nKey="users.resetModal.body"
            values={{ name: user.username }}
            components={{ b: <b /> }}
          />
        </p>
        <TokenLinkField url={tokenUrl('password_reset', link.token)} />
      </div>
      <div className={styles.modalActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Modal>
  );
}
