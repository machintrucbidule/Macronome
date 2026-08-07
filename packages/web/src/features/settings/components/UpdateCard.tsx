import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { toastAfterReload } from '../../../components/Toast/toast-store';
import { reloadPage } from '../../../lib/reload';
import { activateUpdate, checkForUpdate } from '../../../lib/pwa/registerSw';
import { useInstallPrompt } from '../../../lib/pwa/useInstallPrompt';
import { useUpdateAvailable } from '../../../lib/pwa/useUpdateAvailable';
import { SettingsCard } from './SettingsCard';
import styles from '../settings.module.css';

// Mise à jour card (PWA-1, design/components/pwa.md): the version of the bundle you are running
// (baked at build — B-286), the version the server serves when the two differ, a manual "force
// update" button, and an install button shown only when the browser offers installation.
// It renders; it never computes — the availability rule itself lives in `useUpdateAvailable`
// (B-310), shared with the À propos Application card so the two surfaces cannot disagree.

function Row(props: { label: string; desc: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.lab}>
        {props.label}
        <span className={styles.desc}>{props.desc}</span>
      </span>
      {props.children}
    </div>
  );
}

export function UpdateCard() {
  const { t } = useTranslation();
  const { canInstall, promptInstall } = useInstallPrompt();
  const { running, served, hasUpdate } = useUpdateAvailable();
  const [busy, setBusy] = useState(false);

  // B-285: ask the server for a new build, activate it if there is one, then ALWAYS reload —
  // the button is labelled "Forcer la mise à jour" and must be deterministic. The confirmation
  // is stored BEFORE activation: the plugin may reload the document itself once the new worker
  // takes control, so a toast raised later would be lost with it.
  const runUpdate = async (): Promise<void> => {
    setBusy(true);
    const outcome = await checkForUpdate();
    toastAfterReload(t(outcome === 'update-ready' ? 'toast.updateApplied' : 'toast.updateCurrent'));
    if (outcome === 'update-ready') await activateUpdate();
    reloadPage();
  };

  return (
    <SettingsCard
      id="update"
      title={t('settings.update.title')}
      aside={
        <span className={styles.meta}>
          {hasUpdate
            ? t('settings.update.versionUpgrade', { running, served })
            : t('settings.update.version', { version: running })}
        </span>
      }
    >
      <Row label={t('settings.update.refresh.label')} desc={t('settings.update.refresh.desc')}>
        <span className={styles.updRow}>
          {hasUpdate && (
            <span className={styles.updAvail}>{t('settings.update.refresh.available')}</span>
          )}
          <Button variant="ghost" disabled={busy} onClick={() => void runUpdate()}>
            {t(busy ? 'settings.update.refresh.pending' : 'settings.update.refresh.button')}
          </Button>
        </span>
      </Row>
      {canInstall && (
        <Row label={t('settings.update.install.label')} desc={t('settings.update.install.desc')}>
          <Button variant="ghost" onClick={promptInstall}>
            {t('settings.update.install.button')}
          </Button>
        </Row>
      )}
    </SettingsCard>
  );
}
