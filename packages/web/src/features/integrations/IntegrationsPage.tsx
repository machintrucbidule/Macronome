import { useTranslation } from 'react-i18next';
import { AppShell } from '../../app/AppShell';
import { HomeAssistantCard } from './components/HomeAssistantCard';
import { BarclaudeGatewayCard } from './components/BarclaudeGatewayCard';
import styles from './integrations.module.css';

// Intégrations screen (specifications/screens/integrations.md, B-181): account-menu page
// between Assistant IA and Paramètres holding the two local-network connection configs
// (Home Assistant scale import, BarclaudeGateway product search). All remote calls are
// server-side proxies; this page renders and never computes.
export function IntegrationsPage() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className={styles.wrap}>
        <h1 className={styles.h1}>{t('integrations.title')}</h1>
        <p className={styles.lead}>{t('integrations.intro')}</p>

        <HomeAssistantCard />
        <BarclaudeGatewayCard />
      </div>
    </AppShell>
  );
}
