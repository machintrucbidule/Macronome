import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { ICON } from './nav-icons';
import { isMealsActive, NAV_ITEMS } from './nav-items';
import styles from './BottomNav.module.css';

// Mobile-only bottom tab bar (mobile-responsive S3, spec §2.2; design/components/bottom-nav.md).
// The 7 primary routes — same list and order as the desktop top nav, from `nav-items.ts` — as
// icon + short label. Rendered by AppShell on every screen; `display:none` ≥561px, so it is absent
// from the desktop layout and tab order (desktop byte-identical).
//
// B-312: only 5 fit legibly on a phone, so the bar scrolls horizontally, keeps the active tab in
// view, and fades the edge that hides something. Both behaviours are the Repas meal-tab band's,
// reused rather than reinvented (MealTabs.tsx).

type Fade = 'none' | 'left' | 'right' | 'both';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.ic}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      // B-312: the taskbar shortcut SVGs have always declared these; the bar did not, so the same
      // mark rendered with butt caps and miter joins here and round ones in the OS jump list.
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BottomNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const barRef = useRef<HTMLElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [fade, setFade] = useState<Fade>('none');

  const syncFade = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    // 1px of slack: sub-pixel widths otherwise leave a fade showing at either end forever.
    const atStart = bar.scrollLeft <= 1;
    const atEnd = bar.scrollLeft >= bar.scrollWidth - bar.clientWidth - 1;
    setFade(atStart && atEnd ? 'none' : atStart ? 'right' : atEnd ? 'left' : 'both');
  }, []);

  // Keep the current screen's tab visible — it is otherwise the one that can sit off-edge.
  // The call is optional because the bar is mounted by AppShell on every screen, so a jsdom
  // render of any page would otherwise die on a method jsdom does not implement — for a purely
  // visual convenience. Every real browser has it.
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    syncFade();
  }, [pathname, syncFade]);

  const mealsActive = isMealsActive(pathname);
  const cls = (isActive: boolean): string => (isActive ? (styles.active ?? '') : '');
  return (
    <nav
      ref={barRef}
      className={styles.bottomnav}
      data-fade={fade}
      onScroll={syncFade}
      aria-label={t('app.title')}
    >
      {NAV_ITEMS.map((item) => {
        const active = item.to === '/' ? mealsActive : pathname.startsWith(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            ref={active ? activeRef : undefined}
            className={({ isActive }) => cls(item.to === '/' ? mealsActive : isActive)}
          >
            <Icon>{ICON[item.iconKey]}</Icon>
            <span className={styles.lbl}>{t(item.labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
