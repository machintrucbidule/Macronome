import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button/Button';
import { CredentialsStep } from './steps/CredentialsStep';
import { ProfileStep } from './steps/ProfileStep';
import { credentialsValid, profileValid, useSetup } from './useSetup';
import styles from './setup.module.css';

// First-run setup wizard (M8). Shown by AppGate when no account exists yet. Two steps —
// credentials then profile — create the single owner account, open the session, and route
// home. The web only collects + posts; the gating and seeding happen server-side.
export function SetupWizard() {
  const { t } = useTranslation();
  const { draft, set, step, next, back, create, pending, failed } = useSetup();

  return (
    <main className={styles.wizard}>
      <h1>{t('setup.title')}</h1>
      <p className={styles.intro}>{t('setup.intro')}</p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 0) next();
          else void create();
        }}
      >
        {step === 0 ? (
          <CredentialsStep draft={draft} set={set} />
        ) : (
          <ProfileStep draft={draft} set={set} />
        )}

        {failed && <p role="alert">{t('setup.error')}</p>}

        <div className={styles.actions}>
          {step === 1 && (
            <Button variant="ghost" type="button" onClick={back} disabled={pending}>
              {t('setup.back')}
            </Button>
          )}
          {step === 0 ? (
            <Button type="submit" disabled={!credentialsValid(draft)}>
              {t('setup.next')}
            </Button>
          ) : (
            <Button type="submit" disabled={pending || !profileValid(draft)}>
              {t('setup.create')}
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}
