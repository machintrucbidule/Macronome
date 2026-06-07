import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { ConfirmTyped } from '../../../components/Modal/ConfirmTyped';
import { useDataActions } from '../useData';
import styles from '../settings.module.css';

// Données card (specifications/screens/settings.md §Données — IMP-1): export a full snapshot,
// import (REPLACE) one, or wipe tracked data. Wipe + import are irreversible → strong typed
// confirmation; on success the page reloads. It renders; the API computes (logic in useData).
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

export function DataCard() {
  const { t } = useTranslation();
  const a = useDataActions();

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <span className={styles.t}>{t('settings.data.title')}</span>
      </div>
      <div className={styles.cb}>
        <Row label={t('settings.data.export.label')} desc={t('settings.data.export.desc')}>
          <Button variant="ghost" onClick={a.onExport} disabled={a.exporting}>
            {t('settings.data.export.button')}
          </Button>
        </Row>
        <Row label={t('settings.data.import.label')} desc={t('settings.data.import.desc')}>
          <Button variant="ghost" onClick={a.onPickFile}>
            {t('settings.data.import.button')}
          </Button>
        </Row>
        <Row label={t('settings.data.wipe.label')} desc={t('settings.data.wipe.desc')}>
          <Button variant="danger" onClick={() => a.setMode('wipe')}>
            {t('settings.data.wipe.button')}
          </Button>
        </Row>
        {a.error && <div className={styles.error}>{a.error}</div>}
      </div>

      <input
        ref={a.fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={a.onFileChange}
      />

      {a.mode === 'wipe' && (
        <ConfirmTyped
          title={t('settings.data.wipe.modalTitle')}
          word={t('settings.data.wipe.word')}
          confirmLabel={t('settings.data.wipe.confirm')}
          pending={a.wipePending}
          onCancel={() => a.setMode(null)}
          onConfirm={a.confirmWipe}
        >
          <Trans i18nKey="settings.data.wipe.modalBody" components={{ b: <b /> }} />
        </ConfirmTyped>
      )}

      {a.mode === 'import' && (
        <ConfirmTyped
          title={t('settings.data.import.modalTitle')}
          word={t('settings.data.import.word')}
          confirmLabel={t('settings.data.import.confirm')}
          pending={a.importPending}
          onCancel={() => a.setMode(null)}
          onConfirm={a.confirmImport}
        >
          <Trans i18nKey="settings.data.import.modalBody" components={{ b: <b /> }} />
        </ConfirmTyped>
      )}
    </div>
  );
}
