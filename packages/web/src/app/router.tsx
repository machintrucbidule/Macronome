import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/login/LoginPage';
import { AppShell } from './AppShell';
import { HealthStatus } from './HealthStatus';

// Routes → features (module-map.md §2). M0 wires the round-trip home + login shell;
// the primary screens are added milestone by milestone.
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
