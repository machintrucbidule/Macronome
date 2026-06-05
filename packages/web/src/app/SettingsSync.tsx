import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { applyLocale, applyTheme } from './applySettings';
import { PUBLIC_PATHS } from './public-paths';
import { useSettingsQuery } from '../features/settings/useSettings';

// On app load (once authenticated) fetch the persisted settings and apply theme + locale,
// so the user's choices follow them across devices. Logged-out (401) is silent — the
// ThemeProvider's localStorage fast-path already painted a theme. Renders its children.
//
// B-022: skip the probe on the public auth pages (/login, /setup). Otherwise this fires an
// anonymous GET /settings in parallel with AppGate's /auth/setup-state at boot; each
// cookieless request mints its own session, and a late one can clobber the just-created
// authenticated cookie after setup, forcing a single spurious re-login on the next reload.
export function SettingsSync({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data } = useSettingsQuery({ enabled: !PUBLIC_PATHS.has(pathname) });
  const settings = data?.data;

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    applyLocale(settings.locale);
  }, [settings]);

  return <>{children}</>;
}
