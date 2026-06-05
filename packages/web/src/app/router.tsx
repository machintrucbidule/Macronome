import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/login/LoginPage';
import { FoodsPage } from '../features/foods/FoodsPage';
import { RecipesPage } from '../features/recipes/RecipesPage';
import { CiblesPage } from '../features/targets/CiblesPage';
import { JournalPage } from '../features/journal/JournalPage';
import { MealsPage } from '../features/meals/MealsPage';
import { StatsPage } from '../features/stats/StatsPage';
import { WeightPage } from '../features/weight/WeightPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ContainersPage } from '../features/containers/ContainersPage';
import { AccountPage } from '../features/account/AccountPage';
import { AppShell } from './AppShell';
import { HealthStatus } from './HealthStatus';

// Routes → features (module-map.md §2). Repas is the default landing screen (M3b); the
// M0 health round-trip moved to /health when Repas took the home route.
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<MealsPage />} />
        <Route path="/day/:date" element={<MealsPage />} />
        <Route path="/history" element={<JournalPage />} />
        <Route path="/weight" element={<WeightPage />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/cibles" element={<CiblesPage />} />
        <Route path="/parametres" element={<SettingsPage />} />
        <Route path="/containers" element={<ContainersPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/health"
          element={
            <AppShell>
              <HealthStatus />
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
