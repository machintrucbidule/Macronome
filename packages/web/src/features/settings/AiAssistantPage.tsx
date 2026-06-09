import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { AiCard } from './components/AiCard';
import styles from './settings.module.css';

// Assistant IA screen (specifications/screens/ai-assistant.md): a dedicated account-menu page
// (between Contenants and Paramètres) holding the remote OpenAI-compatible connection config,
// the per-task model/prompt blocks and the provider help — moved out of Paramètres (B-130).
// It renders; never computes.
export function AiAssistantPage() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className={styles.wrap}>
        <h1 className={styles.h1}>{t('settings.ai.title')}</h1>
        <p className={styles.lead}>{t('settings.ai.intro')}</p>

        <AiCard />
      </div>
    </AppShell>
  );
}
