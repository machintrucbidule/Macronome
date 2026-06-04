import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/login/LoginPage';
import { FoodsPage } from '../features/foods/FoodsPage';
import { CiblesPage } from '../features/targets/CiblesPage';
import { MealsPage } from '../features/meals/MealsPage';
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
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/cibles" element={<CiblesPage />} />
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
