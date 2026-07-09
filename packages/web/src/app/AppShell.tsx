import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import { BottomNav } from './BottomNav';
import { ThemeToggle } from './ThemeToggle';
import styles from './AppShell.module.css';

// In-app frame: appbar (brand tick + wordmark + primary nav + theme toggle + account menu)
// + page body. Cibles / Contenants / Paramètres / Compte live in the account menu (top-right
// avatar), not the primary nav (specifications/screens/settings.md). `flush` pages (Repas)
// provide their own gutter + full-bleed sticky header, so the page wrapper drops its padding.
//
// Mobile shell (mobile-responsive S3, spec §2): ≤560px the appbar swaps the wordmark for the
// route-derived screen title and hides the top nav + theme toggle (CSS); a fixed BottomNav
// carries the primary routes. All of it is inert/`display:none` ≥561px — desktop unchanged.

// Route prefix → screen-title i18n key (mobile app-bar title). Derived here so no feature
// page needs editing; the title element is `display:none` ≥561px regardless. Repas is the
// special case (home `/` + `/day/:date`); the rest match by path prefix.
const TITLE_KEYS: Record<string, string> = {
  '/history': 'journal.title',
  '/weight': 'weight.title',
  '/foods': 'foods.title',
  '/recipes': 'recipes.title',
  '/stats': 'stats.title',
  '/advices': 'advices.title',
  '/cibles': 'cibles.title',
  '/containers': 'containers.title',
  '/assistant-ia': 'settings.ai.title',
  '/integrations': 'integrations.title',
  '/users': 'users.title',
  '/parametres': 'settings.title',
  '/account': 'menu.account',
  '/about': 'menu.about',
};

function titleKey(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/day/')) return 'meals.title';
  const match = Object.keys(TITLE_KEYS).find((prefix) => pathname.startsWith(prefix));
  return match ? (TITLE_KEYS[match] ?? 'app.title') : 'app.title';
}

export function AppShell({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // Repas is reachable as both `/` and `/day/:date`; keep its tab lit on either (B-014).
  const mealsActive = pathname === '/' || pathname.startsWith('/day/');
  return (
    <div className={styles.root}>
      <header className={styles.appbar}>
        <div className={styles.brand}>
          <span className={styles.tick} aria-hidden="true" />
          <span className={styles.wordmark}>{t('app.title')}</span>
        </div>
        {/* Mobile-only screen title (≤560px); hidden ≥561px. */}
        <span className={styles.appbarTitle}>{t(titleKey(pathname))}</span>
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
          {/* Persistent Conseils entry (B-202): the AI-advice page has no primary tab / account-menu
              entry, so this 💡 is its only entry point — kept visible at every width (unlike the theme
              toggle, it is NOT hidden ≤560px). In `.right` it inherits the WCO app-region:no-drag. */}
          <NavLink
            to="/advices"
            className={({ isActive }) => `${styles.bulb} ${isActive ? styles.bulbActive : ''}`}
            title={t('advices.title')}
            aria-label={t('advices.title')}
          >
            {/* Lightbulb as an SVG (not the 💡 emoji) so it tints via currentColor per top-nav.md. */}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
              <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
            </svg>
          </NavLink>
          {/* Theme toggle is hidden ≤560px (it moves into the account sheet); the wrapper
              keeps that toggle out of ThemeToggle's own module. */}
          <span className={styles.themeToggleWrap}>
            <ThemeToggle />
          </span>
          <AccountMenu />
        </div>
      </header>
      <main className={flush ? styles.pageFlush : styles.page}>{children}</main>
      <BottomNav />
    </div>
  );
}
