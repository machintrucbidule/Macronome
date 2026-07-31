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
// appbar. The two paths are selected by useIsMobile() and show the same titled blocks (B-243).

// Secondary destinations (excluding À propos, rendered separately), in three titled blocks
// (B-243, design/components/top-nav.md): identity, the reference data the user maintains, then
// application configuration — a flat list interleaved the three. `adminOnly` entries are
// filtered on the session role (B-192 conditional-entry pattern) — visibility only; RequireAdmin
// + the API 403 are the real guards. One shared structure feeds both variants.
interface MenuLink {
  to: string;
  key: string;
  adminOnly?: boolean;
}
const MENU_GROUPS: ReadonlyArray<{ labelKey: string; items: readonly MenuLink[] }> = [
  {
    labelKey: 'menu.group.account',
    items: [
      { to: '/account', key: 'menu.account' },
      { to: '/users', key: 'users.title', adminOnly: true },
    ],
  },
  {
    labelKey: 'menu.group.data',
    items: [
      { to: '/targets', key: 'targets.title' },
      { to: '/containers', key: 'containers.title' },
    ],
  },
  {
    labelKey: 'menu.group.config',
    items: [
      { to: '/settings', key: 'settings.title' },
      { to: '/ai-assistant', key: 'settings.ai.title' },
      { to: '/integrations', key: 'integrations.title' },
    ],
  },
];

/** The groups a session may see; a group left with no item renders no heading either. */
function visibleGroups(isAdmin: boolean) {
  return MENU_GROUPS.map((g) => ({
    labelKey: g.labelKey,
    items: g.items.filter((l) => !l.adminOnly || isAdmin),
  })).filter((g) => g.items.length > 0);
}

async function logout(): Promise<void> {
  await authApi.logout();
  window.location.assign('/login');
}

/** The titled blocks, rendered identically by both variants (only the classes differ). */
function MenuGroups({
  isAdmin,
  headingClass,
  itemClass,
  onNavigate,
}: {
  isAdmin: boolean;
  headingClass: string;
  itemClass: string;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {visibleGroups(isAdmin).map((group) => (
        <div key={group.labelKey}>
          {/* A real heading, not a styled div: it labels a section of the menu, so screen
              readers announce the grouping too. */}
          <h3 className={headingClass}>{t(group.labelKey)}</h3>
          {group.items.map((l) => (
            <NavLink key={l.to} to={l.to} className={itemClass} onClick={onNavigate}>
              {t(l.key)}
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );
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
        <MenuGroups
          isAdmin={session.data?.user.is_admin ?? false}
          headingClass={styles.acctGroup ?? ''}
          itemClass={item}
          onNavigate={close}
        />
        {/* Meta block (B-243): one divider, then À propos and Se déconnecter side by side. */}
        <div className={styles.acctSep} />
        <NavLink to="/about" className={item} onClick={close}>
          {t('menu.about')}
        </NavLink>
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
      {/* The sheet's open state lives in React, not in a <details>, so the filled-accent open
          trigger (B-242, top-nav.md) is applied by class here. */}
      <button
        type="button"
        className={`${styles.acctSummary} ${open ? (styles.acctSummaryOpen ?? '') : ''}`}
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
            <MenuGroups
              isAdmin={session.data?.user.is_admin ?? false}
              headingClass={styles.sheetGroup ?? ''}
              itemClass={item}
              onNavigate={close}
            />
            <div className={styles.acctSep} />
            <NavLink to="/about" className={item} onClick={close}>
              {t('menu.about')}
            </NavLink>
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
