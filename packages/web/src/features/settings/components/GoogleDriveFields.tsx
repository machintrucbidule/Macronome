import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../components/Form/NumberInput';
import { TextInput } from '../../../components/Form/TextInput';
import type { GoogleDriveForm } from '../useGoogleDriveBackup';
import styles from '../settings.module.css';

// Config fields of the Google Drive backup card (B-208): the operator's OAuth client
// (client_id + write-only client_secret), the enable toggle, and the schedule (retention +
// daily time). Saved via the card's Save button (settingsApi.patch); the secret follows the
// keep/clear/replace masked pattern (placeholder shows "set" until the user types).
export function GoogleDriveFields({ f }: { f: GoogleDriveForm }) {
  const { t } = useTranslation();
  return (
    <>
      <label className={styles.aiField}>
        <span className={styles.aiFieldLabel}>{t('settings.gdrive.clientId')}</span>
        <TextInput
          value={f.clientId}
          placeholder={t('settings.gdrive.clientIdPlaceholder')}
          onChange={(e) => f.setClientId(e.target.value)}
        />
      </label>

      <label className={styles.aiField}>
        <span className={styles.aiFieldLabel}>{t('settings.gdrive.clientSecret')}</span>
        <TextInput
          type="password"
          value={f.clientSecret}
          placeholder={
            f.clientSecretSet && !f.secretDirty
              ? t('settings.gdrive.secretSet')
              : t('settings.gdrive.clientSecretPlaceholder')
          }
          onChange={(e) => f.setClientSecretValue(e.target.value)}
        />
      </label>

      <div className={styles.aiField}>
        <span className={styles.aiFieldLabel}>{t('settings.gdrive.enable')}</span>
        <div className={styles.seg} role="group" aria-label={t('settings.gdrive.enable')}>
          <button type="button" aria-pressed={!f.enabled} onClick={() => f.setEnabled(false)}>
            {t('settings.gdrive.off')}
          </button>
          <button type="button" aria-pressed={f.enabled} onClick={() => f.setEnabled(true)}>
            {t('settings.gdrive.on')}
          </button>
        </div>
      </div>

      <NumberInput
        label={t('settings.gdrive.retention')}
        suffix={t('settings.gdrive.days')}
        value={f.retentionDays}
        min={1}
        max={90}
        step={1}
        invalid={f.retentionInvalid}
        wrapperClassName={styles.lines}
        onChange={(e) => f.setRetentionDays(Number(e.target.value))}
      />

      <label className={styles.aiField}>
        <span className={styles.aiFieldLabel}>{t('settings.gdrive.time')}</span>
        <TextInput
          type="time"
          value={f.timeOfDay}
          invalid={f.timeInvalid}
          onChange={(e) => f.setTimeOfDay(e.target.value)}
        />
      </label>
    </>
  );
}
