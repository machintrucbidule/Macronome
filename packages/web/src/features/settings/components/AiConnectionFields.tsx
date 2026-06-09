import { useTranslation } from 'react-i18next';
import { TextInput } from '../../../components/Form/TextInput';
import type { useAiConnectionForm } from '../useAiConnectionForm';
import styles from '../settings.module.css';

// Connection fields of the Assistant IA card (design/components/ai-connection.md §Connection
// fields): Base URL with per-provider quick-fill links (Gemini / Claude) + the write-only API key.
// onMouseDown preventDefault keeps the quick-fill links from stealing focus (no scroll jump).
interface AiConnectionFieldsProps {
  f: ReturnType<typeof useAiConnectionForm>;
}

export function AiConnectionFields({ f }: AiConnectionFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.aiField}>
        <TextInput
          label={t('settings.ai.baseUrl')}
          value={f.baseUrl}
          invalid={f.baseUrlInvalid}
          placeholder={t('settings.ai.baseUrlPlaceholder')}
          onChange={(e) => f.setBaseUrl(e.target.value)}
        />
        <div className={styles.aiFillRow}>
          <button
            type="button"
            className={styles.aiFillUrl}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => f.setBaseUrl(t('settings.ai.baseUrlPlaceholder'))}
          >
            {t('settings.ai.fillUrl')}
          </button>
          <button
            type="button"
            className={styles.aiFillUrl}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => f.setBaseUrl(t('settings.ai.claudeUrl'))}
          >
            {t('settings.ai.fillUrlClaude')}
          </button>
        </div>
      </div>

      <label className={styles.aiField}>
        <span className={styles.aiFieldLabel}>{t('settings.ai.apiKey')}</span>
        <TextInput
          type="password"
          value={f.apiKey}
          placeholder={
            f.apiKeySet && !f.keyDirty
              ? t('settings.ai.apiKeySet')
              : t('settings.ai.apiKeyPlaceholder')
          }
          onChange={(e) => f.setApiKeyValue(e.target.value)}
        />
      </label>
    </>
  );
}
