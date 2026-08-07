import { useTranslation } from 'react-i18next';
import { AppearanceCard } from './components/AppearanceCard';
import { MealTemplateCard } from './components/MealTemplateCard';
import { DataCard } from './components/DataCard';
import { GoogleDriveCard } from './components/GoogleDriveCard';
import { UpdateCard } from './components/UpdateCard';
import { useHashScroll } from './useHashScroll';
import styles from './settings.module.css';

// Paramètres screen (specifications/screens/settings.md): appearance & language, the default
// day structure (+ garde-manger) and data management. Account, profile, containers and the
// AI-assistant connection are separate account-menu entries. It renders; never computes.
export function SettingsPage() {
  const { t } = useTranslation();
  useHashScroll();
  return (
    <>
      <div className={styles.wrap}>
        <h1 className={styles.h1}>{t('settings.title')}</h1>
        <p className={styles.lead}>{t('settings.lead')}</p>

        <AppearanceCard />
        <MealTemplateCard />
        <DataCard />
        <GoogleDriveCard />
        <UpdateCard />
      </div>
    </>
  );
}
