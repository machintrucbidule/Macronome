import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../../api/auth';
import { Button } from '../../../components/Button/Button';
import { Modal } from '../../../components/Modal/Modal';
import { TextInput } from '../../../components/Form/TextInput';
import styles from '../account.module.css';

// Password change — a dedicated secure flow (screens/account.md): never inline on the card.
// Validates locally (match + length), then POSTs; a 401 means the current password is wrong.
export function PasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (): Promise<void> => {
    if (next.length < 8) return setError(t('account.modal.tooShort'));
    if (next !== confirm) return setError(t('account.modal.mismatch'));
    setError(null);
    setPending(true);
    try {
      await authApi.changePassword({ current_password: current, new_password: next });
      setDone(true);
      setTimeout(onClose, 900);
    } catch {
      // The only expected failure is a wrong current password (401); validation is local.
      setError(t('account.modal.wrong'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal title={t('account.modal.title')} size="confirm" mobile="sheet" onClose={onClose}>
      <div className={styles.modalBody}>
        <TextInput
          label={t('account.modal.current')}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <TextInput
          label={t('account.modal.new')}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <TextInput
          label={t('account.modal.confirm')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <span className={styles.error}>{error}</span>}
        {done && <span className={styles.success}>{t('account.modal.success')}</span>}
      </div>
      <div className={styles.modalActions}>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" disabled={pending || done} onClick={() => void submit()}>
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  );
}
