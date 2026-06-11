import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/Button/Button';
import { api } from '../../../api/client';
import { forceUpdate } from '../../../lib/pwa/registerSw';
import { useInstallPrompt } from '../../../lib/pwa/useInstallPrompt';
import styles from '../settings.module.css';

// Mise à jour card (PWA-1, design/components/pwa.md): the running version (read from the public
// /health endpoint — the web never decides the number, ADR-0002), a manual "force update" button
// (new versions otherwise apply silently on next launch), and an install button shown only when
// the browser offers installation. It renders; it never computes.
interface Health {
  status: string;
  db: string;
  version: string;
}

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
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<Health>('/health') });
  const version = health.data?.version;

  return (
    <div className={styles.card}>
      <div className={styles.ch}>
        <span className={styles.t}>{t('settings.update.title')}</span>
        {version && (
          <span className={styles.meta}>{t('settings.update.version', { version })}</span>
        )}
      </div>
      <div className={styles.cb}>
        <Row label={t('settings.update.refresh.label')} desc={t('settings.update.refresh.desc')}>
          <Button variant="ghost" onClick={() => void forceUpdate()}>
            {t('settings.update.refresh.button')}
          </Button>
        </Row>
        {canInstall && (
          <Row label={t('settings.update.install.label')} desc={t('settings.update.install.desc')}>
            <Button variant="ghost" onClick={promptInstall}>
              {t('settings.update.install.button')}
            </Button>
          </Row>
        )}
      </div>
    </div>
  );
}
