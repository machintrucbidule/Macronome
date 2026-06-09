import type { ReactElement } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/login/LoginPage';
import { SetupWizard } from '../features/setup/SetupWizard';
import { FoodsPage } from '../features/foods/FoodsPage';
import { RecipesPage } from '../features/recipes/RecipesPage';
import { CiblesPage } from '../features/targets/CiblesPage';
import { JournalPage } from '../features/journal/JournalPage';
import { MealsPage } from '../features/meals/MealsPage';
import { StatsPage } from '../features/stats/StatsPage';
import { WeightPage } from '../features/weight/WeightPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AiAssistantPage } from '../features/settings/AiAssistantPage';
import { ContainersPage } from '../features/containers/ContainersPage';
import { AccountPage } from '../features/account/AccountPage';
import { AboutPage } from '../features/about/AboutPage';
import { AppShell } from './AppShell';
import { AppGate } from './AppGate';
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
  ['/cibles', <CiblesPage />],
  ['/containers', <ContainersPage />],
  ['/assistant-ia', <AiAssistantPage />],
  ['/parametres', <SettingsPage />],
  ['/account', <AccountPage />],
  ['/about', <AboutPage />],
  [
    '/health',
    <AppShell>
      <HealthStatus />
    </AppShell>,
  ],
];

export function AppRouter() {
  return (
    <BrowserRouter>
      <SettingsSync>
        <AppGate>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupWizard />} />
            {PROTECTED.map(([path, element]) => (
              <Route key={path} path={path} element={<RequireAuth>{element}</RequireAuth>} />
            ))}
          </Routes>
        </AppGate>
      </SettingsSync>
    </BrowserRouter>
  );
}
