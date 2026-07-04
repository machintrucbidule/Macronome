import { useTranslation } from 'react-i18next';
import { useSettingsQuery } from '../../settings/useSettings';
import styles from '../foods.module.css';

// "Recherche chronodrive" link-button under the food name field (B-182). Rendered only
// when the BarclaudeGateway integration is configured (settings gate — the dialog's
// proxies would 409 otherwise).
export function ChronoSearchLink({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const gateway = useSettingsQuery().data?.data.integrations.barclaude_gateway ?? null;
  if (!gateway) return null;
  return (
    <button type="button" className={styles.chronolink} onClick={onOpen}>
      {t('foods.chrono.link')}
    </button>
  );
}
