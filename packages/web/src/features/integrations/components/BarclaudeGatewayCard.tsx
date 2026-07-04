import { useTranslation } from 'react-i18next';
import { TextInput } from '../../../components/Form/TextInput';
import { useGatewayForm } from '../useGatewayForm';
import { ConnectionActions } from './ConnectionActions';
import styles from '../integrations.module.css';

// BarclaudeGateway card (specifications/screens/integrations.md §Card 2): base URL
// (host+port) + write-only API key. "Tester" persists then pings (the connection proof).
export function BarclaudeGatewayCard() {
  const { t } = useTranslation();
  const f = useGatewayForm();

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>{t('integrations.gateway.title')}</div>
      <div className={styles.body}>
        <TextInput
          label={t('integrations.baseUrl')}
          value={f.baseUrl}
          invalid={f.baseUrlInvalid}
          placeholder={t('integrations.gateway.baseUrlPlaceholder')}
          onChange={(e) => f.setBaseUrl(e.target.value)}
        />
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('integrations.gateway.apiKey')}</span>
          <TextInput
            type="password"
            value={f.apiKey}
            placeholder={
              f.apiKeySet && !f.keyDirty
                ? t('integrations.secretSet')
                : t('integrations.gateway.apiKeyPlaceholder')
            }
            onChange={(e) => f.setApiKeyValue(e.target.value)}
          />
        </label>
        <p className={styles.note}>{t('integrations.gateway.keyHint')}</p>

        <ConnectionActions
          f={f}
          testNote={
            f.testResult && t('integrations.gateway.testOk', { version: f.testResult.version })
          }
        />
      </div>
    </div>
  );
}
