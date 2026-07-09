import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import type { GoogleDriveForm } from '../useGoogleDriveBackup';
import styles from '../settings.module.css';

// Action row of the Google Drive backup card (B-208): Connect (OAuth) or Disconnect on the
// left; Back-up-now (when connected) + Save (the config) on the right. Connect is disabled
// until the client creds are saved; disconnect keeps the creds (1-click reconnect).
const preventFocus = (e: MouseEvent): void => e.preventDefault();

export function GoogleDriveActions({ f }: { f: GoogleDriveForm }) {
  const { t } = useTranslation();
  return (
    <div className={styles.gdriveActions}>
      {f.connected ? (
        <Button
          variant="ghost"
          onMouseDown={preventFocus}
          onClick={f.onDisconnect}
          disabled={f.disconnectPending}
        >
          {t('settings.gdrive.disconnect')}
        </Button>
      ) : (
        <Button
          variant="ghost"
          onMouseDown={preventFocus}
          onClick={f.connect}
          disabled={!f.configured}
        >
          {t('settings.gdrive.connect')}
        </Button>
      )}
      <div className={styles.gdriveActionsRight}>
        {f.connected && (
          <Button
            variant="ghost"
            onMouseDown={preventFocus}
            onClick={f.onBackupNow}
            disabled={f.backupPending}
          >
            {f.backupPending ? t('settings.gdrive.backingUp') : t('settings.gdrive.backupNow')}
          </Button>
        )}
        <Button onMouseDown={preventFocus} onClick={f.saveConfig} disabled={f.savePending}>
          {t('settings.gdrive.save')}
        </Button>
      </div>
    </div>
  );
}
