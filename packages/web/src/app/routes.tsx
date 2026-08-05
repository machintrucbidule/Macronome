import { lazyNamed } from '../lib/lazyNamed';
import { RequireAdmin } from './RequireAdmin';

// Routes → features (module-map.md §2). Repas is the default landing screen (M3b); the M0 health
// round-trip moved to /health when Repas took the home route.
//
// ROUTE SHAPE (B-266/B-274 — do not undo when adding a route):
//  1. Every protected route holds a **lazy component factory**, never a built element. The old
//     `['/history', <JournalPage />]` shape constructed all 20 pages at import time, which put the
//     whole app in one chunk and made React.lazy inert.
//  2. Pages render their **content only** — the app chrome is a layout route (see router.tsx), so
//     no page mounts AppShell itself.
// `login` / `setup` stay eagerly imported in router.tsx: they are the cold-start path.
const page = lazyNamed;

const MealsPage = page(() => import('../features/meals/MealsPage'), 'MealsPage');
const JournalPage = page(() => import('../features/journal/JournalPage'), 'JournalPage');
const WeightPage = page(() => import('../features/weight/WeightPage'), 'WeightPage');
const FoodsPage = page(() => import('../features/foods/FoodsPage'), 'FoodsPage');
const RecipesPage = page(() => import('../features/recipes/RecipesPage'), 'RecipesPage');
const StatsPage = page(() => import('../features/stats/StatsPage'), 'StatsPage');
const AdvicesPage = page(() => import('../features/advices/AdvicesPage'), 'AdvicesPage');
const TargetsPage = page(() => import('../features/targets/TargetsPage'), 'TargetsPage');
const ContainersPage = page(
  () => import('../features/containers/ContainersPage'),
  'ContainersPage',
);
const AiAssistantPage = page(
  () => import('../features/settings/AiAssistantPage'),
  'AiAssistantPage',
);
const IntegrationsPage = page(
  () => import('../features/integrations/IntegrationsPage'),
  'IntegrationsPage',
);
const UsersPage = page(() => import('../features/users/UsersPage'), 'UsersPage');
const SettingsPage = page(() => import('../features/settings/SettingsPage'), 'SettingsPage');
const AccountPage = page(() => import('../features/account/AccountPage'), 'AccountPage');
const AboutPage = page(() => import('../features/about/AboutPage'), 'AboutPage');
const HealthStatus = page(() => import('./HealthStatus'), 'HealthStatus');
const NotFoundPage = page(() => import('../features/not-found/NotFoundPage'), 'NotFoundPage');

/** `path → element`. Rendered inside the shell layout route, itself inside RequireAuth. */
export const PROTECTED: ReadonlyArray<readonly [string, JSX.Element]> = [
  ['/', <MealsPage />],
  ['/day/:date', <MealsPage />],
  ['/history', <JournalPage />],
  ['/weight', <WeightPage />],
  ['/foods', <FoodsPage />],
  ['/recipes', <RecipesPage />],
  ['/stats', <StatsPage />],
  ['/advices', <AdvicesPage />],
  ['/targets', <TargetsPage />],
  ['/containers', <ContainersPage />],
  ['/ai-assistant', <AiAssistantPage />],
  ['/integrations', <IntegrationsPage />],
  [
    '/users',
    <RequireAdmin>
      <UsersPage />
    </RequireAdmin>,
  ],
  ['/settings', <SettingsPage />],
  ['/account', <AccountPage />],
  ['/about', <AboutPage />],
  ['/health', <HealthStatus />],
  // Catch-all (B-241) — last, and inside the guard like every other route: an unknown URL from a
  // logged-out visitor goes to /login (uniform behaviour), not to the app frame.
  ['*', <NotFoundPage />],
];
