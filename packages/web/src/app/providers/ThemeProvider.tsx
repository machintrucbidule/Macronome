import { useEffect, type ReactNode } from 'react';
import { syncThemeColor } from '../applySettings';

// Applies the persisted theme mode to <html data-theme> on mount (theming.md §1).
// Default mode is dark; `system` resolves from prefers-color-scheme.
type ThemeMode = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'macronome.theme';

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'dark';
    document.documentElement.setAttribute('data-theme', resolve(stored));
    syncThemeColor();
    // Toggling the window-controls-overlay on/off changes display-mode without a reload; re-sync
    // theme-color so the WCO title band follows (--bg-elev in WCO, --bg otherwise) — B-205.
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(display-mode: window-controls-overlay)');
    const onChange = (): void => syncThemeColor();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return <>{children}</>;
}
