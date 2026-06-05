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

export function applyTheme(mode: Theme): void {
  document.documentElement.setAttribute('data-theme', resolveTheme(mode));
  localStorage.setItem(THEME_STORAGE_KEY, mode);
}

export function applyLocale(locale: Locale): void {
  if (i18n.language !== locale) void i18n.changeLanguage(locale);
  document.documentElement.setAttribute('lang', locale);
}
