import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/login/LoginPage';
import { FoodsPage } from '../features/foods/FoodsPage';
import { CiblesPage } from '../features/targets/CiblesPage';
import { AppShell } from './AppShell';
import { HealthStatus } from './HealthStatus';

// Routes → features (module-map.md §2). M0 wires the round-trip home + login shell;
// the primary screens are added milestone by milestone (M1: Aliments).
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/foods" element={<FoodsPage />} />
        <Route path="/cibles" element={<CiblesPage />} />
        <Route
          path="/"
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
