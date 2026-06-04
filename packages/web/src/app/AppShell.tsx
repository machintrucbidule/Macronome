import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import styles from './AppShell.module.css';

// In-app frame: appbar (wordmark + primary nav + theme toggle) + page body. The nav
// grows screen by screen (M1 adds Aliments); the account menu and remaining tabs
// arrive with their milestones.
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
          {/* Cibles belongs in the account menu (specifications/screens/targets.md);
              shown in primary nav until the menu lands in M9. */}
          <NavLink to="/cibles" className={({ isActive }) => (isActive ? styles.active : '')}>
            {t('cibles.title')}
          </NavLink>
        </nav>
        <span className={styles.spacer} />
        <ThemeToggle />
      </header>
      <main className={styles.page}>{children}</main>
    </div>
  );
}
