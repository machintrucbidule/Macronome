import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthTopBar } from '../../app/AuthTopBar';
import { useLogin, type LoginState } from './useLogin';
import styles from './LoginPage.module.css';

// Pre-auth login surface (design/components/states.md §Login). A single card whose
// data-state (idle|loading|error|lockout|success) is driven entirely by the server via
// useLogin; CSS reveals the matching banner / countdown / success flash. The web renders,
// never decides. Shared pre-auth top-bar (language + theme) per theming.md.

function StateAlert({ state, lockSeconds }: { state: LoginState; lockSeconds: number }) {
  const { t } = useTranslation();
  if (state === 'error')
    return (
      <div className={styles.alert} role="alert">
        {t('login.error')}
      </div>
    );
  if (state === 'lockout')
    return (
      <div className={styles.alert} role="alert">
        {t('login.lockout')} <span className={styles.count}>{lockSeconds}</span>&nbsp;
        {t('login.seconds')}.
      </div>
    );
  return null;
}

function SuccessFlash() {
  const { t } = useTranslation();
  return (
    <div className={styles.success} role="status">
      <div className={styles.ring} aria-hidden="true">
        ✓
      </div>
      <p>{t('login.success')}</p>
      <div className={styles.go}>{t('login.redirect')}</div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { state, lockSeconds, submit } = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [stay, setStay] = useState(false);

  const locked = state === 'lockout';
  const invalid = state === 'error';

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    if (state === 'loading' || locked) return;
    void submit(username, password, stay);
  }

  return (
    <div className={styles.shell} data-state={state}>
      <AuthTopBar />
      <main className={styles.card} aria-labelledby="login-wordmark">
        <form className={styles.formBody} onSubmit={onSubmit}>
          <div className={styles.brand}>
            <span className={styles.tick} aria-hidden="true" />
            <span className={styles.wordmark} id="login-wordmark">
              {t('app.title')}
            </span>
          </div>
          <div className={styles.tagline}>{t('login.tagline')}</div>

          <StateAlert state={state} lockSeconds={lockSeconds} />

          <label className={styles.field}>
            <span className={styles.label}>{t('login.username')}</span>
            <input
              name="username"
              autoComplete="username"
              value={username}
              disabled={locked}
              aria-invalid={invalid}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t('login.password')}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={locked}
              aria-invalid={invalid}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label className={styles.stay}>
            <input
              type="checkbox"
              checked={stay}
              disabled={locked}
              onChange={(e) => setStay(e.target.checked)}
            />
            <span>{t('login.staySignedIn')}</span>
          </label>

          {!locked && (
            <button className={styles.submit} type="submit" disabled={state === 'loading'}>
              {state === 'loading' ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : (
                <span>{t('login.submit')}</span>
              )}
            </button>
          )}

          <div className={styles.host}>{t('login.host')}</div>
        </form>

        {state === 'success' && <SuccessFlash />}
      </main>
    </div>
  );
}
