import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { authApi } from '../api/auth';
import { initials, useSession } from './useSession';
import styles from './AppShell.module.css';

// Account menu (specifications/screens/settings.md): the top-right avatar dropdown holding
// the non-primary screens (Compte, Cibles, Contenants, Assistant IA, Paramètres) + logout. A native
// <details> gives click-to-open + Esc/outside behaviour; navigating closes it.
export function AccountMenu() {
  const { t } = useTranslation();
  const session = useSession();
  const ref = useRef<HTMLDetailsElement>(null);
  const close = (): void => ref.current?.removeAttribute('open');
  const item = styles.acctItem ?? '';

  const logout = async (): Promise<void> => {
    await authApi.logout();
    window.location.assign('/login');
  };

  return (
    <details ref={ref} className={styles.acct}>
      <summary className={styles.acctSummary} title={session.data?.user.username}>
        {initials(session.data?.user.username)}
      </summary>
      <div className={styles.acctPop}>
        <NavLink to="/account" className={item} onClick={close}>
          {t('menu.account')}
        </NavLink>
        <NavLink to="/cibles" className={item} onClick={close}>
          {t('cibles.title')}
        </NavLink>
        <NavLink to="/containers" className={item} onClick={close}>
          {t('containers.title')}
        </NavLink>
        <NavLink to="/assistant-ia" className={item} onClick={close}>
          {t('settings.ai.title')}
        </NavLink>
        <NavLink to="/parametres" className={item} onClick={close}>
          {t('settings.title')}
        </NavLink>
        <div className={styles.acctSep} />
        <NavLink to="/about" className={item} onClick={close}>
          {t('menu.about')}
        </NavLink>
        <div className={styles.acctSep} />
        <button type="button" className={`${item} ${styles.logout}`} onClick={() => void logout()}>
          {t('menu.logout')}
        </button>
      </div>
    </details>
  );
}
