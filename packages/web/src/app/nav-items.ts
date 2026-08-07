// The primary navigation, in one place (B-311).
//
// The desktop top nav (`AppShell`) and the mobile bottom bar (`BottomNav`) show the same routes
// in the same order; until B-311 each held its own hard-coded JSX list, so a 7th entry meant
// editing two files and hoping they stayed in step. Both now map this array.
//
// Order is the contract's (design/components/top-nav.md §Anatomy, masterplan): Conseils is last,
// appended when B-311 removed the appbar lightbulb that had been its only entry point.

import type { NavIconKey } from './nav-icons';

export interface NavItem {
  /** Route path, exactly as declared in `routes.tsx`. */
  to: string;
  /** i18n key for the label — the same string on both surfaces. */
  labelKey: string;
  /** Key into the glyph map in `nav-icons.tsx` (used by the bottom bar only). */
  iconKey: NavIconKey;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', labelKey: 'meals.title', iconKey: 'meals' },
  { to: '/history', labelKey: 'journal.title', iconKey: 'journal' },
  { to: '/weight', labelKey: 'weight.title', iconKey: 'weight' },
  { to: '/foods', labelKey: 'foods.title', iconKey: 'foods' },
  { to: '/recipes', labelKey: 'recipes.title', iconKey: 'recipes' },
  { to: '/stats', labelKey: 'stats.title', iconKey: 'stats' },
  { to: '/advices', labelKey: 'advices.title', iconKey: 'advices' },
];

/**
 * Repas is reachable as both `/` and `/day/:date`, so its entry cannot rely on `NavLink`'s own
 * `isActive` (B-014). Both navigations call this rather than repeating the test.
 */
export function isMealsActive(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/day/');
}
