import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './BottomNav.module.css';

// Mobile-only bottom tab bar (mobile-responsive S3, spec §2.2; design/components/bottom-nav.md).
// The 6 primary routes — same order as the desktop top nav (top-nav.md) — as icon + short
// label. Rendered by AppShell on every screen; `display:none` ≥561px, so it is absent from the
// desktop layout and tab order (desktop byte-identical). Icons are the stroke SVGs from
// specifications/features/mobile-responsive/mockups/01-shell.html.

const ICON = {
  meals: <path d="M6 3v8m0 0a2 2 0 0 0 2-2V3M4 3v6m12-6c-1.5 0-2 4-2 6h2m0-6v18" />,
  journal: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9h16M8 3v4M16 3v4" />
    </>
  ),
  weight: (
    <>
      <path d="M5 21h14a2 2 0 0 0 2-2 9 9 0 0 0-18 0 2 2 0 0 0 2 2Z" />
      <path d="M12 12l3-4" />
    </>
  ),
  foods: (
    <path d="M12 8c0-3 2-5 5-4 1 4-1 6-5 6m0-2c0-2-2-4-4-3-.8 3 .8 5 4 5m0-3c4 0 5 3 4 7-1 3-3 4-4 4s-3-1-4-4c-1-4 0-7 4-7Z" />
  ),
  recipes: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h11v15H6a2 2 0 0 0-2 2zM17 3v15" />
      <path d="M7 7h6M7 10h6" />
    </>
  ),
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
} as const;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.ic}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // Repas is reachable as both `/` and `/day/:date`; keep its tab lit on either (B-014),
  // mirroring AppShell's top-nav rule.
  const mealsActive = pathname === '/' || pathname.startsWith('/day/');
  const active = (isActive: boolean): string => (isActive ? (styles.active ?? '') : '');
  return (
    <nav className={styles.bottomnav} aria-label={t('app.title')}>
      <NavLink to="/" className={() => active(mealsActive)}>
        <Icon>{ICON.meals}</Icon>
        <span className={styles.lbl}>{t('meals.title')}</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => active(isActive)}>
        <Icon>{ICON.journal}</Icon>
        <span className={styles.lbl}>{t('journal.title')}</span>
      </NavLink>
      <NavLink to="/weight" className={({ isActive }) => active(isActive)}>
        <Icon>{ICON.weight}</Icon>
        <span className={styles.lbl}>{t('weight.title')}</span>
      </NavLink>
      <NavLink to="/foods" className={({ isActive }) => active(isActive)}>
        <Icon>{ICON.foods}</Icon>
        <span className={styles.lbl}>{t('foods.title')}</span>
      </NavLink>
      <NavLink to="/recipes" className={({ isActive }) => active(isActive)}>
        <Icon>{ICON.recipes}</Icon>
        <span className={styles.lbl}>{t('recipes.title')}</span>
      </NavLink>
      <NavLink to="/stats" className={({ isActive }) => active(isActive)}>
        <Icon>{ICON.stats}</Icon>
        <span className={styles.lbl}>{t('stats.title')}</span>
      </NavLink>
    </nav>
  );
}
