import { useTranslation } from 'react-i18next';
import type { Locale, Theme } from '@macronome/shared';
import { applyLocale, applyTheme } from '../../../app/applySettings';
import { useSettingsMutation, useSettingsQuery } from '../useSettings';
import styles from '../settings.module.css';

// Apparence & langue card (screens/settings.md): theme (system/light/dark) + language
// (FR/EN) apply live and persist to app_user.settings; units are read-only (metric only).
const THEMES: Theme[] = ['system', 'light', 'dark'];
const THEME_KEY: Record<Theme, string> = {
  system: 'settings.appearance.themeSystem',
  light: 'settings.appearance.themeLight',
  dark: 'settings.appearance.themeDark',
};

export function AppearanceCard() {
  const { t } = useTranslation();
  const settings = useSettingsQuery().data?.data;
  const mutation = useSettingsMutation();

  const theme = settings?.theme ?? 'dark';
  const locale = settings?.locale ?? 'fr';

  const setTheme = (mode: Theme): void => {
    applyTheme(mode);
    mutation.mutate({ theme: mode });
  };
  const setLocale = (next: Locale): void => {
    applyLocale(next);
    mutation.mutate({ locale: next });
  };

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <span className={styles.t}>{t('settings.appearance.title')}</span>
      </div>
      <div className={styles.cb}>
        <div className={styles.row}>
          <span className={styles.lab}>{t('settings.appearance.theme')}</span>
          <div className={styles.seg}>
            {THEMES.map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={theme === mode}
                onClick={() => setTheme(mode)}
              >
                {t(THEME_KEY[mode])}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.lab}>{t('settings.appearance.language')}</span>
          <div className={styles.seg}>
            <button type="button" aria-pressed={locale === 'fr'} onClick={() => setLocale('fr')}>
              {t('settings.appearance.fr')}
            </button>
            <button type="button" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>
              {t('settings.appearance.en')}
            </button>
          </div>
        </div>
        <div className={styles.row}>
          <span className={styles.lab}>
            {t('settings.appearance.units')}
            <span className={styles.desc}>{t('settings.appearance.unitsNote')}</span>
          </span>
          <span className={styles.ro}>{t('settings.appearance.unitsValue')}</span>
        </div>
      </div>
    </div>
  );
}
