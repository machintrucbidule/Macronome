import { useEffect } from 'react';
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
// gating and seeding happen server-side. With `inviteToken` (B-193, hosted by InvitePage)
// the same steps register an invited account bound to the token; `onDeadLink` fires when
// the token dies mid-flow so the host can show the dead-link screen.
function StepBody({
  step,
  draft,
  set,
}: {
  step: number;
  draft: Parameters<typeof CredentialsStep>[0]['draft'];
  set: Parameters<typeof CredentialsStep>[0]['set'];
}) {
  if (step === 0) return <CredentialsStep draft={draft} set={set} />;
  if (step === 1) return <ProfileStep draft={draft} set={set} />;
  return <TargetsStep draft={draft} set={set} />;
}

export function SetupWizard({
  inviteToken,
  onDeadLink,
}: {
  inviteToken?: string;
  onDeadLink?: () => void;
} = {}) {
  const { t } = useTranslation();
  const { draft, set, step, next, back, create, pending, failed, deadLink, usernameTaken } =
    useSetup({ inviteToken });
  const stepValid = step === 0 ? credentialsValid(draft) : profileValid(draft);

  // The invite died mid-flow (revoked/expired while filling) — hand over to the host.
  useEffect(() => {
    if (deadLink) onDeadLink?.();
  }, [deadLink, onDeadLink]);
  if (deadLink) return null;

  return (
    <main className={styles.wizard}>
      <AuthTopBar />
      <h1>{t(inviteToken ? 'invite.title' : 'setup.title')}</h1>
      <p className={styles.intro}>{t(inviteToken ? 'invite.intro' : 'setup.intro')}</p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 2) void create();
          else next();
        }}
      >
        <StepBody step={step} draft={draft} set={set} />

        {failed && <p role="alert">{t('setup.error')}</p>}
        {usernameTaken && <p role="alert">{t('invite.usernameTaken')}</p>}

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
