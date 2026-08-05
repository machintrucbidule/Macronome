import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/login/LoginPage';
import { SetupWizard } from '../features/setup/SetupWizard';
import { InvitePage } from '../features/invite/InvitePage';
import { ResetPage } from '../features/reset/ResetPage';
import { ContextMenuProvider } from '../components/ContextMenu/ContextMenuProvider';
import { AppShell } from './AppShell';
import { AppGate } from './AppGate';
import { LaunchHandler } from './LaunchHandler';
import { LEGACY_REDIRECTS, LegacyRedirect } from './legacy-redirects';
import { RequireAuth } from './RequireAuth';
import { SettingsSync } from './SettingsSync';
import { PROTECTED } from './routes';

// The route tree. The table itself lives in routes.tsx (lazy page factories); this file only
// nests the guards and the chrome.
//
// AppGate forces the first-run wizard while no owner account exists (M8); RequireAuth then
// redirects logged-out visitors of any app route to /login (M9b). Only /login and /setup are
// public — plus the token-link pages; the /health diagnostic UI is gated too (the underlying
// /api/v1/health readiness endpoint stays public).
//
// B-274: AppShell is a **layout route**, not a per-page wrapper. Mounted once, it survives every
// in-app navigation, so the appbar, the bottom nav and the animated brand tick are never rebuilt
// (the tick's swing used to restart on each page change) and only the page content swaps.
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
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                {PROTECTED.map(([path, element]) => (
                  <Route key={path} path={path} element={element} />
                ))}
              </Route>
            </Routes>
          </ContextMenuProvider>
        </AppGate>
      </SettingsSync>
    </BrowserRouter>
  );
}
