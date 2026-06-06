import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { authApi } from '../../api/auth';
import { useSession } from '../../app/useSession';
import { Button } from '../../components/Button/Button';
import { PasswordModal } from './modals/PasswordModal';
import styles from './account.module.css';

// Compte screen (specifications/screens/account.md): credentials + session only. The
// metabolic profile lives on Cibles. Password change is a dedicated modal (never inline).
export function AccountPage() {
  const { t } = useTranslation();
  const session = useSession();
  const [pwOpen, setPwOpen] = useState(false);

  const logout = async (): Promise<void> => {
    await authApi.logout();
    window.location.assign('/login');
  };

  return (
    <AppShell>
      <div className={styles.wrap}>
        <h1 className={styles.h1}>{t('account.title')}</h1>

        <div className={styles.card}>
          <div className={styles.ch}>{t('account.credentials')}</div>
          <div className={styles.cb}>
            <div className={styles.row}>
              <span className={styles.lab}>{t('account.username')}</span>
              <span className={styles.ro}>{session.data?.user.username ?? '—'}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.lab}>{t('account.password')}</span>
              <Button variant="ghost" onClick={() => setPwOpen(true)}>
                {t('account.changePassword')}
              </Button>
            </div>
            <div className={styles.row}>
              <span className={styles.lab}>{t('account.session')}</span>
              <Button variant="danger" onClick={() => void logout()}>
                {t('account.logout')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </AppShell>
  );
}
