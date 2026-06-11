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

// Keep the PWA `theme-color` meta (OS status-bar colour) in sync with the active theme by
// reading the live `--bg` token — no hardcoded hex, so it tracks the palette (PWA-1, rule 6).
export function syncThemeColor(): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) meta.setAttribute('content', bg);
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
