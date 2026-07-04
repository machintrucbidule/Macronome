import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../../components/Banner/Banner';
import { Button } from '../../../components/Button/Button';
import styles from '../integrations.module.css';

// Shared bottom section of a connection card: the "Tester" row (persist-then-test proof),
// the mapped error banner, and the Déconnecter/Enregistrer actions. Both cards feed it
// from their form hook (useHaForm / useGatewayForm — same contract).
interface ConnectionActionsProps {
  f: {
    configured: boolean;
    runTest: () => void;
    testPending: boolean;
    testError: string | null;
    onSave: () => void;
    onDisconnect: () => void;
    savePending: boolean;
  };
  /** Success note next to the Tester button (already formatted by the card). */
  testNote: ReactNode;
}

export function ConnectionActions({ f, testNote }: ConnectionActionsProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.testRow}>
        <Button variant="ghost" onClick={f.runTest} disabled={f.testPending}>
          {f.testPending ? t('integrations.testing') : t('integrations.test')}
        </Button>
        {testNote && <span className={styles.note}>{testNote}</span>}
      </div>
      {f.testError && <Banner tone="warning">{t(`integrations.errors.${f.testError}`)}</Banner>}

      <div className={styles.actions}>
        {f.configured && (
          <Button variant="ghost" onClick={f.onDisconnect} disabled={f.savePending}>
            {t('integrations.disconnect')}
          </Button>
        )}
        <div className={styles.actionsRight}>
          <Button onClick={f.onSave} disabled={f.savePending}>
            {t('integrations.save')}
          </Button>
        </div>
      </div>
    </>
  );
}
