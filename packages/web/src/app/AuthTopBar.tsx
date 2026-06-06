import { useTranslation } from 'react-i18next';
import i18n from '../i18n/config';
import { applyLocale } from './applySettings';
import { ThemeToggle } from './ThemeToggle';
import styles from './AuthTopBar.module.css';

// Shared pre-auth top bar (Login + first-run setup wizard, theming.md §1): fixed top-right,
// FR/EN segmented group + dark/light ThemeToggle. Both apply client-side and live. The web
// renders, never decides.
export function AuthTopBar() {
  const { t } = useTranslation();
  return (
    <div className={styles.topbar}>
      <div className={styles.seg} role="group" aria-label={t('login.languageGroup')}>
        <button
          type="button"
          aria-pressed={i18n.language === 'fr'}
          onClick={() => applyLocale('fr')}
        >
          FR
        </button>
        <span className={styles.sep} />
        <button
          type="button"
          aria-pressed={i18n.language === 'en'}
          onClick={() => applyLocale('en')}
        >
          EN
        </button>
      </div>
      <ThemeToggle />
    </div>
  );
}
