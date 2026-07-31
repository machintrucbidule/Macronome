import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Banner } from '../../../components/Banner/Banner';
import { useGoogleDriveBackup } from '../useGoogleDriveBackup';
import { GoogleDriveActions } from './GoogleDriveActions';
import { GoogleDriveFields } from './GoogleDriveFields';
import { GoogleDriveHelp } from './GoogleDriveHelp';
import { SettingsCard } from './SettingsCard';
import styles from '../settings.module.css';

// Google Drive backup card (specifications/screens/settings.md, B-208): OAuth Connect + the
// scheduling config, a last-backup status line, a manual backup, disconnect, the setup guide
// and the cleartext note. Renders; never computes — display state comes from the redacted
// settings.integrations.google_drive.
const formatDate = (iso: string, lang: string): string =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

/** Read + consume the OAuth-callback marker (/settings?gdrive=connected | ?gdrive_error=code). */
function useGdriveFlash() {
  const [params, setParams] = useSearchParams();
  const [flash, setFlash] = useState<{ ok: boolean; error?: string } | null>(null);
  const ok = params.get('gdrive');
  const error = params.get('gdrive_error');
  useEffect(() => {
    if (!ok && !error) return;
    setFlash(error ? { ok: false, error } : { ok: true });
    setParams({}, { replace: true });
  }, [ok, error, setParams]);
  return { flash, dismiss: (): void => setFlash(null) };
}

export function GoogleDriveCard() {
  const { t, i18n } = useTranslation();
  const f = useGoogleDriveBackup();
  const { flash, dismiss } = useGdriveFlash();

  return (
    <SettingsCard
      id="gdrive"
      title={t('settings.gdrive.title')}
      defaultOpen={false}
      bodyClassName={styles.aiBody}
      aside={
        <span className={styles.pill}>
          {f.connected ? t('settings.gdrive.connected') : t('settings.gdrive.notConnected')}
        </span>
      }
    >
      <p className={styles.aiIntro}>{t('settings.gdrive.desc')}</p>

      {flash?.ok && (
        <Banner tone="info" onDismiss={dismiss}>
          {t('settings.gdrive.connectedOk')}
        </Banner>
      )}
      {flash?.error && (
        <Banner tone="warning" onDismiss={dismiss}>
          {t(`settings.gdrive.errors.${flash.error}`)}
        </Banner>
      )}

      <GoogleDriveFields f={f} />

      <p className={styles.aiNote}>
        {f.lastBackupAt
          ? t('settings.gdrive.lastBackup', { date: formatDate(f.lastBackupAt, i18n.language) })
          : t('settings.gdrive.neverBackedUp')}
        {f.lastStatus === 'error' && ` — ${t('settings.gdrive.lastFailed')}`}
        {f.folderUrl && (
          <>
            {' · '}
            <a href={f.folderUrl} target="_blank" rel="noreferrer">
              {t('settings.gdrive.openFolder')}
            </a>
          </>
        )}
      </p>

      {f.connectError && (
        <Banner tone="warning">{t(`settings.gdrive.errors.${f.connectError}`)}</Banner>
      )}
      {f.backupError && (
        <Banner tone="warning">{t(`settings.gdrive.errors.${f.backupError}`)}</Banner>
      )}

      <GoogleDriveHelp />

      <p className={styles.aiNote}>{t('settings.gdrive.cleartextNote')}</p>

      <GoogleDriveActions f={f} />
    </SettingsCard>
  );
}
