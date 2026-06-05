import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { Button } from '../../components/Button/Button';
import { AppearanceCard } from './components/AppearanceCard';
import { MealTemplateCard } from './components/MealTemplateCard';
import styles from './settings.module.css';

// Paramètres screen (specifications/screens/settings.md): appearance & language, the default
// day structure (+ garde-manger), and the inert AI-advisor placeholder. Account, profile and
// containers are separate account-menu entries. It renders; it never computes.
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className={styles.wrap}>
        <h1 className={styles.h1}>{t('settings.title')}</h1>
        <p className={styles.lead}>{t('settings.lead')}</p>

        <AppearanceCard />
        <MealTemplateCard />

        <div className={`${styles.card} ${styles.soon}`}>
          <div className={styles.ch}>
            <span className={styles.t}>{t('settings.ai.title')}</span>
            <span className={styles.pill}>{t('settings.ai.soon')}</span>
          </div>
          <div className={styles.cb}>
            <div className={styles.row}>
              <span className={styles.lab}>
                {t('settings.ai.label')}
                <span className={styles.desc}>{t('settings.ai.note')}</span>
              </span>
              <Button variant="ghost" disabled>
                {t('settings.ai.configure')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
