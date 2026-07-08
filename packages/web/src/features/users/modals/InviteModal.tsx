import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreatedToken } from '@macronome/shared';
import { Button } from '../../../components/Button/Button';
import { Modal } from '../../../components/Modal/Modal';
import { TokenLinkField } from '../components/TokenLinkField';
import { tokenUrl, useTokenMutations } from '../useTokens';
import styles from '../users.module.css';

// Invitation modal (screens/users.md, B-193) — two phases: pick the role, then the
// created link shown once (readonly input + copy). Single-use, 7-day expiry.
export function InviteModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { createInvite } = useTokenMutations();
  const [isAdmin, setIsAdmin] = useState(false);
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [failed, setFailed] = useState(false);

  const generate = (): void => {
    setFailed(false);
    createInvite.mutate(isAdmin, {
      onSuccess: (res) => setCreated(res.data),
      onError: () => setFailed(true),
    });
  };

  return (
    <Modal title={t('users.inviteModal.title')} size="confirm" onClose={onClose}>
      <div className={styles.modalBody}>
        {created ? (
          <>
            <p>{t('users.inviteModal.createdBody')}</p>
            <TokenLinkField url={tokenUrl('invite', created.token)} />
          </>
        ) : (
          <>
            <p>{t('users.inviteModal.body')}</p>
            <label className={styles.radioRow}>
              <input
                type="radio"
                name="invite-role"
                checked={!isAdmin}
                onChange={() => setIsAdmin(false)}
              />
              <span>{t('account.typeUser')}</span>
            </label>
            <label className={styles.radioRow}>
              <input
                type="radio"
                name="invite-role"
                checked={isAdmin}
                onChange={() => setIsAdmin(true)}
              />
              <span>{t('account.typeAdmin')}</span>
            </label>
            {failed && <p className={styles.modalError}>{t('users.errors.generic')}</p>}
          </>
        )}
      </div>
      <div className={styles.modalActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
        {!created && (
          <Button onClick={generate} disabled={createInvite.isPending}>
            {t('users.inviteModal.generate')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
