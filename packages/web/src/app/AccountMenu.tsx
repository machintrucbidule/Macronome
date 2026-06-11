import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { authApi } from '../api/auth';
import { Modal } from '../components/Modal/Modal';
import { ThemeToggle } from './ThemeToggle';
import { useIsMobile } from '../lib/useIsMobile';
import { initials, useSession } from './useSession';
import styles from './AppShell.module.css';

// Account menu (specifications/screens/settings.md): the top-right avatar holding the
// non-primary screens (Compte, Cibles, Contenants, Assistant IA, Paramètres) + À propos +
// logout. Desktop (≥561px) keeps the native <details> dropdown (B-131 outside-click close).
// Mobile (≤560px, mobile-responsive S3, spec §2.4) renders a bottom sheet (the default mobile
// Modal presentation) that also carries the theme toggle moved out of the
// appbar. The two paths are selected by useIsMobile() — desktop dropdown stays byte-identical.

const LINKS = [
  { to: '/account', key: 'menu.account' },
  { to: '/cibles', key: 'cibles.title' },
  { to: '/containers', key: 'containers.title' },
  { to: '/assistant-ia', key: 'settings.ai.title' },
  { to: '/parametres', key: 'settings.title' },
  { to: '/about', key: 'menu.about' },
] as const;

async function logout(): Promise<void> {
  await authApi.logout();
  window.location.assign('/login');
}

export function AccountMenu() {
  return useIsMobile() ? <AccountSheet /> : <AccountDropdown />;
}

// Desktop dropdown — unchanged behaviour (native <details> + outside-click close, B-131).
function AccountDropdown() {
  const { t } = useTranslation();
  const session = useSession();
  const ref = useRef<HTMLDetailsElement>(null);
  const close = (): void => ref.current?.removeAttribute('open');
  const item = styles.acctItem ?? '';

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const el = ref.current;
      if (el?.open && !el.contains(e.target as Node)) el.removeAttribute('open');
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  return (
    <details ref={ref} className={styles.acct}>
      <summary className={styles.acctSummary} title={session.data?.user.username}>
        {initials(session.data?.user.username)}
      </summary>
      <div className={styles.acctPop}>
        {LINKS.slice(0, 5).map((l) => (
          <NavLink key={l.to} to={l.to} className={item} onClick={close}>
            {t(l.key)}
          </NavLink>
        ))}
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

// Mobile bottom sheet — the theme toggle (moved off the appbar) sits in the sheet's top bar,
// between the username title and the close "×" (headerAction); the body holds the secondary
// destinations + logout.
function AccountSheet() {
  const { t } = useTranslation();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const close = (): void => setOpen(false);
  const item = styles.sheetItem ?? '';

  return (
    <>
      <button
        type="button"
        className={styles.acctSummary}
        title={session.data?.user.username}
        onClick={() => setOpen(true)}
      >
        {initials(session.data?.user.username)}
      </button>
      {open && (
        <Modal
          title={session.data?.user.username ?? t('menu.account')}
          headerAction={<ThemeToggle />}
          onClose={close}
        >
          <div className={styles.sheetBody}>
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={item} onClick={close}>
                {t(l.key)}
              </NavLink>
            ))}
            <button
              type="button"
              className={`${item} ${styles.logout}`}
              onClick={() => void logout()}
            >
              {t('menu.logout')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
