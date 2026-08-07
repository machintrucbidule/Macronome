import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { SkeletonRows } from '../components/states/SkeletonRows';
import { AccountMenu } from './AccountMenu';
import { BottomNav } from './BottomNav';
import { DayToneRule } from './DayToneRule';
import { ErrorBoundary } from './ErrorBoundary';
import { OfflineBanner } from './OfflineBanner';
import { isMealsActive, NAV_ITEMS } from './nav-items';
import { ThemeToggle } from './ThemeToggle';
import { useScrollRestoration } from './useScrollRestoration';
import styles from './AppShell.module.css';

// In-app frame: appbar (brand tick + wordmark + primary nav + theme toggle + account menu)
// + page body. Cibles / Contenants / Paramètres / Compte live in the account menu (top-right
// avatar), not the primary nav (specifications/screens/settings.md). The `.right` cluster holds
// no always-on icon button since B-311 removed the Conseils lightbulb.
//
// B-274: this is a **layout route** (router.tsx), mounted once for the whole session — the page
// renders into the <Outlet/> below. Nothing here is rebuilt on navigation, which is what stopped
// the brand tick's swing from restarting on every page change and keeps the bottom nav in place.
// Repas is "flush" (it provides its own gutter + full-bleed sticky header, so the page wrapper
// drops its padding); that is derived from the pathname here, exactly like the nav highlight,
// rather than passed in by the page.
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
  '/targets': 'targets.title',
  '/containers': 'containers.title',
  '/ai-assistant': 'settings.ai.title',
  '/integrations': 'integrations.title',
  '/users': 'users.title',
  '/settings': 'settings.title',
  '/account': 'menu.account',
  '/about': 'menu.about',
};

function titleKey(pathname: string): string {
  if (pathname === '/' || pathname.startsWith('/day/')) return 'meals.title';
  const match = Object.keys(TITLE_KEYS).find((prefix) => pathname.startsWith(prefix));
  return match ? (TITLE_KEYS[match] ?? 'app.title') : 'app.title';
}

export function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  useScrollRestoration();
  // Repas is reachable as both `/` and `/day/:date`; keep its tab lit on either (B-014). The same
  // test decides `flush`: Repas is the only flush screen.
  const mealsActive = isMealsActive(pathname);
  const flush = mealsActive;
  return (
    <div className={styles.root}>
      <header className={styles.appbar}>
        <div className={styles.brand}>
          <span className={styles.tick} aria-hidden="true" />
          <span className={styles.wordmark}>{t('app.title')}</span>
        </div>
        {/* Mobile-only screen title (≤560px); hidden ≥561px. */}
        <span className={styles.appbarTitle}>{t(titleKey(pathname))}</span>
        {/* B-311: one shared list (`nav-items.ts`) drives this nav AND the bottom bar. Conseils is
            its last entry — it used to be a 💡 icon button in `.right`, exempt from every
            responsive hide because it had no other entry point; giving it a slot in both
            navigations removed that justification, so the button went with it. */}
        <nav className={styles.nav} aria-label={t('app.title')}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                (item.to === '/' ? mealsActive : isActive) ? styles.active : ''
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className={styles.right}>
          {/* Theme toggle is hidden ≤560px (it moves into the account sheet); the wrapper
              keeps that toggle out of ThemeToggle's own module. */}
          <span className={styles.themeToggleWrap}>
            <ThemeToggle />
          </span>
          <AccountMenu />
        </div>
        {/* B-262: the day-tone rule lives INSIDE the sticky header, absolutely positioned at its
            lower edge. It must not be a block in the flow: `--appbar-h` is the sticky offset shared
            by the Repas day bar, the table headers, ListChrome and Poids, and 2px of extra height
            knocked all of them out of true (visible as the Repas totals band jittering on scroll). */}
        <DayToneRule />
      </header>
      {/* B-260: one global "server unreachable" banner, above the page body. */}
      <OfflineBanner />
      {/* B-253 (motion.md §F): the route content fades in on navigation. `key={pathname}` is what
          replays the animation — React reuses the same <main> across routes otherwise. Opacity
          only, and nothing outside <main> participates, so the appbar, the day-tone rule and the
          navigation stay perfectly still while the page arrives. */}
      <main
        key={pathname}
        className={`${flush ? styles.pageFlush : styles.page} ${styles.routeFade}`}
      >
        {/* B-265: one screen may fail without taking the frame with it. Keyed on the pathname
            because React never resets a boundary on its own — otherwise a crashed screen would
            keep showing the recovery card after you navigated away.
            B-266: the Suspense fallback covers the route's code chunk arriving; a skeleton, never
            a spinner (states.md §Loading states). */}
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<SkeletonRows />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}
