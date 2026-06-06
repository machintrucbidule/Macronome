import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { ThemeToggle } from './ThemeToggle';
import styles from './AppShell.module.css';

// In-app frame: appbar (brand tick + wordmark + primary nav + theme toggle + account menu)
// + page body. Cibles / Contenants / Paramètres / Compte live in the account menu (top-right
// avatar), not the primary nav (specifications/screens/settings.md). `flush` pages (Repas)
// provide their own gutter + full-bleed sticky header, so the page wrapper drops its padding.
export function AppShell({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // Repas is reachable as both `/` and `/day/:date`; keep its tab lit on either (B-014).
  const mealsActive = pathname === '/' || pathname.startsWith('/day/');
  return (
    <div>
      <header className={styles.appbar}>
        <div className={styles.brand}>
          <span className={styles.tick} aria-hidden="true" />
          <span className={styles.wordmark}>{t('app.title')}</span>
        </div>
        <nav className={styles.nav} aria-label={t('app.title')}>
          <NavLink to="/" className={() => (mealsActive ? styles.active : '')}>
            {t('meals.title')}
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => (isActive ? styles.active : '')}>
            {t('journal.title')}
          </NavLink>
          <NavLink to="/weight" className={({ isActive }) => (isActive ? styles.active : '')}>
            {t('weight.title')}
          </NavLink>
          <NavLink to="/foods" className={({ isActive }) => (isActive ? styles.active : '')}>
            {t('foods.title')}
          </NavLink>
          <NavLink to="/recipes" className={({ isActive }) => (isActive ? styles.active : '')}>
            {t('recipes.title')}
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? styles.active : '')}>
            {t('stats.title')}
          </NavLink>
        </nav>
        <div className={styles.right}>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>
      <main className={flush ? styles.pageFlush : styles.page}>{children}</main>
    </div>
  );
}
