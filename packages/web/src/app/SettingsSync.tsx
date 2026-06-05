import { useEffect, type ReactNode } from 'react';
import { applyLocale, applyTheme } from './applySettings';
import { useSettingsQuery } from '../features/settings/useSettings';

// On app load (once authenticated) fetch the persisted settings and apply theme + locale,
// so the user's choices follow them across devices. Logged-out (401) is silent — the
// ThemeProvider's localStorage fast-path already painted a theme. Renders its children.
export function SettingsSync({ children }: { children: ReactNode }) {
  const { data } = useSettingsQuery();
  const settings = data?.data;

  useEffect(() => {
    if (!settings) return;
    applyTheme(settings.theme);
    applyLocale(settings.locale);
  }, [settings]);

  return <>{children}</>;
}
