import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { authApi } from '../../api/auth';
import { useSession } from '../../app/useSession';
import { Button } from '../../components/Button/Button';
import { PasswordModal } from './modals/PasswordModal';
import { ProfileForm } from './components/ProfileForm';
import { useProfile } from './useProfile';
import styles from './account.module.css';

// Compte screen (specifications/screens/account.md): credentials + session, plus the metabolic
// profile (sex / birth date / height) in a "Mes informations" frame (B-060 — moved off Cibles).
// Password change is a dedicated modal (never inline).
export function AccountPage() {
  const { t } = useTranslation();
  const session = useSession();
  const profile = useProfile();
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

        <div className={styles.card}>
          <div className={styles.ch}>{t('account.profileInfo')}</div>
          <div className={styles.cb}>
            {profile.data ? (
              <ProfileForm profile={profile.data.data} />
            ) : (
              <p className={styles.lab}>—</p>
            )}
          </div>
        </div>
      </div>

      {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
    </AppShell>
  );
}
