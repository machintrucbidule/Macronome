import { useTranslation } from 'react-i18next';
import { AuthTopBar } from '../../app/AuthTopBar';
import { Button } from '../../components/Button/Button';
import { CredentialsStep } from './steps/CredentialsStep';
import { ProfileStep } from './steps/ProfileStep';
import { TargetsStep } from './steps/TargetsStep';
import { credentialsValid, profileValid, targetsValid, useSetup } from './useSetup';
import styles from './setup.module.css';

// First-run setup wizard (M8). Shown by AppGate when no account exists yet. Three steps —
// credentials, profile, then targets (B-059) — create the single owner account, open the
// session, persist the initial targets, and route home. The web only collects + posts; the
// gating and seeding happen server-side.
export function SetupWizard() {
  const { t } = useTranslation();
  const { draft, set, step, next, back, create, pending, failed } = useSetup();
  const stepValid = step === 0 ? credentialsValid(draft) : profileValid(draft);

  return (
    <main className={styles.wizard}>
      <AuthTopBar />
      <h1>{t('setup.title')}</h1>
      <p className={styles.intro}>{t('setup.intro')}</p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 2) void create();
          else next();
        }}
      >
        {step === 0 ? (
          <CredentialsStep draft={draft} set={set} />
        ) : step === 1 ? (
          <ProfileStep draft={draft} set={set} />
        ) : (
          <TargetsStep draft={draft} set={set} />
        )}

        {failed && <p role="alert">{t('setup.error')}</p>}

        <div className={styles.actions}>
          {step > 0 && (
            <Button variant="ghost" type="button" onClick={back} disabled={pending}>
              {t('setup.back')}
            </Button>
          )}
          {step === 2 ? (
            <Button type="submit" disabled={pending || !targetsValid(draft)}>
              {t('setup.create')}
            </Button>
          ) : (
            <Button type="submit" disabled={!stepValid}>
              {t('setup.next')}
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}
