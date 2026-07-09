import { useTranslation } from 'react-i18next';
import styles from '../settings.module.css';

// Exhaustive, collapsible operator setup guide for the Google Drive backup (B-208,
// specifications/screens/settings.md). Same <details> pattern as AiHelp. Each step links to
// the exact Google page; step 7 shows the precise callback URL the operator must register —
// derived from the current origin so it is copy-paste correct behind their reverse proxy.
const CONSOLE = 'https://console.cloud.google.com/';
const DRIVE_API = 'https://console.cloud.google.com/apis/library/drive.googleapis.com';
const CONSENT = 'https://console.cloud.google.com/apis/credentials/consent';
const CREDENTIALS = 'https://console.cloud.google.com/apis/credentials';

export function GoogleDriveHelp() {
  const { t } = useTranslation();
  const callbackUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/v1/integrations/google-drive/callback`
      : '';

  return (
    <details className={styles.aiHelp}>
      <summary>{t('settings.gdrive.help.title')}</summary>
      <p>{t('settings.gdrive.help.intro')}</p>
      <ol>
        <li>
          {t('settings.gdrive.help.step1')}{' '}
          <a href={CONSOLE} target="_blank" rel="noreferrer">
            {t('settings.gdrive.help.consoleLink')}
          </a>
        </li>
        <li>
          {t('settings.gdrive.help.step2')}{' '}
          <a href={DRIVE_API} target="_blank" rel="noreferrer">
            {t('settings.gdrive.help.driveApiLink')}
          </a>
        </li>
        <li>
          {t('settings.gdrive.help.step3')}{' '}
          <a href={CONSENT} target="_blank" rel="noreferrer">
            {t('settings.gdrive.help.consentLink')}
          </a>
        </li>
        <li>{t('settings.gdrive.help.step4')}</li>
        <li>{t('settings.gdrive.help.step5')}</li>
        <li>
          {t('settings.gdrive.help.step6')}{' '}
          <a href={CREDENTIALS} target="_blank" rel="noreferrer">
            {t('settings.gdrive.help.credentialsLink')}
          </a>
        </li>
        <li>
          {t('settings.gdrive.help.step7')}
          <code className={styles.gdriveCallback}>{callbackUrl}</code>
        </li>
        <li>{t('settings.gdrive.help.step8')}</li>
      </ol>
      <p className={styles.aiNote}>{t('settings.gdrive.help.publishNote')}</p>
    </details>
  );
}
