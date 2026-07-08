import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { AuthTopBar } from '../../app/AuthTopBar';
import { Button } from '../../components/Button/Button';
import styles from './reset.module.css';

// Set-new-password screen (B-194, screens/login.md §Password-reset screen). Opened
// from an admin-generated reset link (/reset#<token> — fragment, never logged). The
// token is probed on mount; on success the token is consumed, the account's old
// sessions are revoked server-side, and we land on /login with a success banner
// (owner decision — the user proves the new password by logging in).
type State = 'probing' | 'form' | 'dead';

function DeadScreen() {
  const { t } = useTranslation();
  return (
    <main className={styles.dead}>
      <AuthTopBar />
      <h1>{t('reset.deadTitle')}</h1>
      <p>{t('reset.deadBody')}</p>
      <Link to="/login">{t('invite.toLogin')}</Link>
    </main>
  );
}

function PasswordField({
  label,
  value,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  invalid?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        aria-invalid={invalid ?? false}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function ResetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [token] = useState(() => window.location.hash.slice(1));
  const [state, setState] = useState<State>(token ? 'probing' : 'dead');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .tokenState(token)
      .then((res) => {
        if (!cancelled) setState(res.valid && res.kind === 'password_reset' ? 'form' : 'dead');
      })
      .catch(() => {
        if (!cancelled) setState('dead');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const valid = password.length >= 8 && password === confirm;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    setFailed(false);
    try {
      await authApi.resetPassword({ token, new_password: password });
      void navigate('/login', { state: { resetDone: true } });
    } catch {
      // token_invalid (revoked/expired mid-flow) or a transport error.
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  if (state === 'probing') return null;
  if (state === 'dead') return <DeadScreen />;

  return (
    <div className={styles.shell}>
      <AuthTopBar />
      <main className={styles.card}>
        <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
          <h1>{t('reset.title')}</h1>
          <p className={styles.intro}>{t('reset.intro')}</p>

          {failed && (
            <p className={styles.alert} role="alert">
              {t('reset.error')}
            </p>
          )}

          <PasswordField label={t('reset.newPassword')} value={password} onChange={setPassword} />
          <PasswordField
            label={t('reset.confirmPassword')}
            value={confirm}
            invalid={confirm.length > 0 && confirm !== password}
            onChange={setConfirm}
          />
          <p className={styles.hint}>{t('reset.hint')}</p>

          <Button type="submit" disabled={!valid || pending}>
            {t('reset.submit')}
          </Button>
        </form>
      </main>
    </div>
  );
}
