import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Appbar dark/light segmented toggle (theming.md §1). The tri-state
// Système/Clair/Sombre lives in Paramètres (later milestone).
type Theme = 'light' | 'dark';
const STORAGE_KEY = 'macronome.theme';

function currentTheme(): Theme {
  return (document.documentElement.getAttribute('data-theme') as Theme | null) ?? 'dark';
}

export function ThemeToggle() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <button
      type="button"
      aria-label={t('theme.toggle')}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? '●' : '○'}
    </button>
  );
}
