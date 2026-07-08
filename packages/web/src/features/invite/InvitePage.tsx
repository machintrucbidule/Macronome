import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { AuthTopBar } from '../../app/AuthTopBar';
import { SetupWizard } from '../setup/SetupWizard';
import styles from './invite.module.css';

// Invitation landing (B-193, screens/login.md §Invitation wizard variant). The
// single-use token rides in the URL fragment (/invite#<token>) so it never reaches
// server logs; it is read once on mount and probed via POST /auth/token-state (CSRF
// cookie already minted — AppGate resolved setup-state before this page rendered).
// Valid → the 3-step setup wizard bound to the token; anything else → dead link.
type State = 'probing' | 'valid' | 'dead';

export function InvitePage() {
  const { t } = useTranslation();
  const [token] = useState(() => window.location.hash.slice(1));
  const [state, setState] = useState<State>(token ? 'probing' : 'dead');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .tokenState(token)
      .then((res) => {
        if (!cancelled) setState(res.valid && res.kind === 'invite' ? 'valid' : 'dead');
      })
      .catch(() => {
        if (!cancelled) setState('dead');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'probing') return null;
  if (state === 'valid')
    return <SetupWizard inviteToken={token} onDeadLink={() => setState('dead')} />;

  return (
    <main className={styles.dead}>
      <AuthTopBar />
      <h1>{t('invite.deadTitle')}</h1>
      <p>{t('invite.deadBody')}</p>
      <Link to="/login">{t('invite.toLogin')}</Link>
    </main>
  );
}
