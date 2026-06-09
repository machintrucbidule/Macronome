import { useTranslation } from 'react-i18next';
import styles from '../settings.module.css';

// Collapsible step-by-step help for the Assistant IA card (design/components/ai-connection.md
// §Help): how to get a Gemini key, fill the URL, fetch models. Renders only.
export function AiHelp() {
  const { t } = useTranslation();
  return (
    <details className={styles.aiHelp}>
      <summary>{t('settings.ai.help.title')}</summary>
      <p>{t('settings.ai.help.intro')}</p>
      <ol>
        <li>
          {t('settings.ai.help.step1')}{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            {t('settings.ai.help.studioLink')}
          </a>
        </li>
        <li>{t('settings.ai.help.step2')}</li>
        <li>{t('settings.ai.help.step3', { url: t('settings.ai.baseUrlPlaceholder') })}</li>
        <li>{t('settings.ai.help.step4')}</li>
      </ol>
      <p className={styles.aiNote}>{t('settings.ai.help.modelNote')}</p>
    </details>
  );
}
