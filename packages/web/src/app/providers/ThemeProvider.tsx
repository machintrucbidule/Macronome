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
  }, []);

  return <>{children}</>;
}
