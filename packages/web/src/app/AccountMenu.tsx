import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { authApi } from '../api/auth';
import { initials, useSession } from './useSession';
import styles from './AppShell.module.css';

// Account menu (specifications/screens/settings.md): the top-right avatar dropdown holding
// the non-primary screens (Compte, Cibles, Contenants, Assistant IA, Paramètres) + logout. A native
// <details> gives click-to-open + Esc; a pointerdown handler closes it on an outside click (B-131,
// which a bare <details> does NOT do); navigating also closes it.
export function AccountMenu() {
  const { t } = useTranslation();
  const session = useSession();
  const ref = useRef<HTMLDetailsElement>(null);
  const close = (): void => ref.current?.removeAttribute('open');
  const item = styles.acctItem ?? '';

  // Close on an outside click (B-131): native <details> only closes on Esc / re-clicking the summary.
  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.removeAttribute('open');
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

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
