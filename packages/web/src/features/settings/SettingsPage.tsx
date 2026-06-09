import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { AppearanceCard } from './components/AppearanceCard';
import { MealTemplateCard } from './components/MealTemplateCard';
import { DataCard } from './components/DataCard';
import { AiCard } from './components/AiCard';
import styles from './settings.module.css';

// Paramètres screen (specifications/screens/settings.md): appearance & language, the default
// day structure (+ garde-manger), data management, and the AI-assistant connection card.
// Account, profile and containers are separate account-menu entries. It renders; never computes.
export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className={styles.wrap}>
        <h1 className={styles.h1}>{t('settings.title')}</h1>
        <p className={styles.lead}>{t('settings.lead')}</p>

        <AppearanceCard />
        <MealTemplateCard />
        <DataCard />
        <AiCard />
      </div>
    </AppShell>
  );
}
