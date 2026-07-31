import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/login/LoginPage';
import { SetupWizard } from '../features/setup/SetupWizard';
import { InvitePage } from '../features/invite/InvitePage';
import { ResetPage } from '../features/reset/ResetPage';
import { FoodsPage } from '../features/foods/FoodsPage';
import { RecipesPage } from '../features/recipes/RecipesPage';
import { TargetsPage } from '../features/targets/TargetsPage';
import { JournalPage } from '../features/journal/JournalPage';
import { MealsPage } from '../features/meals/MealsPage';
import { StatsPage } from '../features/stats/StatsPage';
import { AdvicesPage } from '../features/advices/AdvicesPage';
import { WeightPage } from '../features/weight/WeightPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AiAssistantPage } from '../features/settings/AiAssistantPage';
import { IntegrationsPage } from '../features/integrations/IntegrationsPage';
import { ContainersPage } from '../features/containers/ContainersPage';
import { UsersPage } from '../features/users/UsersPage';
import { AccountPage } from '../features/account/AccountPage';
import { AboutPage } from '../features/about/AboutPage';
import { NotFoundPage } from '../features/not-found/NotFoundPage';
import { ContextMenuProvider } from '../components/ContextMenu/ContextMenuProvider';
import { AppShell } from './AppShell';
import { AppGate } from './AppGate';
import { LaunchHandler } from './LaunchHandler';
import { LEGACY_REDIRECTS, LegacyRedirect } from './legacy-redirects';
import { RequireAdmin } from './RequireAdmin';
import { RequireAuth } from './RequireAuth';
import { SettingsSync } from './SettingsSync';
import { HealthStatus } from './HealthStatus';

// Routes → features (module-map.md §2). Repas is the default landing screen (M3b); the
// M0 health round-trip moved to /health when Repas took the home route. AppGate forces the
// first-run wizard while no owner account exists (M8); RequireAuth then redirects logged-out
// visitors of any app route to /login (M9b). Only /login and /setup are public; the /health
// diagnostic UI is gated too (the underlying /api/v1/health readiness endpoint stays public).
const PROTECTED: ReadonlyArray<[string, ReactElement]> = [
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
  [
    '/health',
    <AppShell>
      <HealthStatus />
    </AppShell>,
  ],
  // Catch-all (B-241) — last, and inside the guard like every other route: an unknown URL from a
  // logged-out visitor goes to /login (uniform behaviour), not to the app frame.
  ['*', <NotFoundPage />],
];

export function AppRouter() {
  return (
    <BrowserRouter>
      {/* App-shortcut / deep-link navigation when the installed app is already open (B-183). */}
      <LaunchHandler />
      <SettingsSync>
        <AppGate>
          {/* Installed-window right-click menu (B-195) — inert in browser tabs / on mobile. */}
          <ContextMenuProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/setup" element={<SetupWizard />} />
              {/* Token-link pages (B-193/B-194) — public; the token rides the URL fragment. */}
              <Route path="/invite" element={<InvitePage />} />
              <Route path="/reset" element={<ResetPage />} />
              {/* Retired French paths (B-240): rewritten before the auth guard runs. */}
              {LEGACY_REDIRECTS.map(([from, to]) => (
                <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
              ))}
              {PROTECTED.map(([path, element]) => (
                <Route key={path} path={path} element={<RequireAuth>{element}</RequireAuth>} />
              ))}
            </Routes>
          </ContextMenuProvider>
        </AppGate>
      </SettingsSync>
    </BrowserRouter>
  );
}
