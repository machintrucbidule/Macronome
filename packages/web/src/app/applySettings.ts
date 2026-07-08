import type { Locale, Theme } from '@macronome/shared';
import i18n from '../i18n/config';

// Apply the user's persisted appearance/language to the live document (theming.md §1–2).
// Theme writes <html data-theme> + the localStorage fast-path the ThemeProvider reads on
// next load; locale drives i18next. Pure side-effects, shared by the bootstrap sync and the
// Paramètres controls so a change is reflected app-wide immediately.

const THEME_STORAGE_KEY = 'macronome.theme';

function resolveTheme(mode: Theme): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return mode;
}

// Keep the PWA `theme-color` meta in sync with the active theme by reading a live token — no
// hardcoded hex, so it tracks the palette (PWA-1, rule 6). Normally `--bg` (the OS status-bar
// colour on mobile / a browser tab). In the installed WCO window the browser paints the strip
// behind the native window buttons with theme-color, so there we use `--bg-elev` to match the
// header → one uniform title band across the full width, no seam (B-205).
export function syncThemeColor(): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const wco =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: window-controls-overlay)').matches;
  const token = wco ? '--bg-elev' : '--bg';
  const color = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (color) meta.setAttribute('content', color);
}

export function applyTheme(mode: Theme): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(mode));
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  syncThemeColor();
}

export function applyLocale(locale: Locale): void {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  document.documentElement.setAttribute('lang', locale);
}
