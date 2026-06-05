import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { ThemeToggle } from './ThemeToggle';
import styles from './AppShell.module.css';

// In-app frame: appbar (wordmark + primary nav + theme toggle + account menu) + page body.
// Cibles / Contenants / Paramètres / Compte live in the account menu (top-right avatar),
// not the primary nav (specifications/screens/settings.md).
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div>
      <header className={styles.appbar}>
        <span className={styles.wordmark}>{t('app.title')}</span>
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : '')}>
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
        <span className={styles.spacer} />
        <div className={styles.right}>
          <ThemeToggle />
          <AccountMenu />
        </div>
      </header>
      <main className={styles.page}>{children}</main>
    </div>
  );
}
