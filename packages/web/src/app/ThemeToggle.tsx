import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { syncThemeColor } from './applySettings';
import styles from './ThemeToggle.module.css';

// Appbar dark/light segmented toggle (design/components/00-foundations.md §Segmented control,
// theming.md §1). 2-button single-select: ● dark / ○ light. The tri-state
// Système/Clair/Sombre lives in Paramètres.
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
    syncThemeColor();
  }, [theme]);

  return (
    <div className={styles.seg} role="group" aria-label={t('theme.toggle')}>
      <button
        type="button"
        className={styles.segBtn}
        aria-label={t('theme.dark')}
        aria-pressed={theme === 'dark'}
        onClick={() => setTheme('dark')}
      >
        ●
      </button>
      <span className={styles.sep} aria-hidden="true" />
      <button
        type="button"
        className={styles.segBtn}
        aria-label={t('theme.light')}
        aria-pressed={theme === 'light'}
        onClick={() => setTheme('light')}
      >
        ○
      </button>
    </div>
  );
}
