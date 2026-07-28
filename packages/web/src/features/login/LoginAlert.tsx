import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LoginErrorKind, LoginFailure, LoginState } from './useLogin';
import styles from './LoginPage.module.css';

// The login card's alert (design/components/states.md §Login). One banner whose copy is chosen by
// the failure kind, plus the lockout countdown variant.
//
// Distinct copy per kind is the point of B-223/B-231: a cookie/proxy misconfiguration or a database
// outage must not read as a wrong password, and the message for those says what to look at.
const ERROR_KEY: Record<LoginErrorKind, string> = {
  credentials: 'login.error',
  session: 'login.errorSession',
  database: 'login.errorDatabase',
  application: 'login.errorApp',
  unreachable: 'login.errorUnreachable',
};

// The diagnostic code identifying the server-side black-box record (ops.md §6b). Selectable text is
// the primary affordance and the copy button is progressive enhancement: a self-hosted instance
// reached over plain HTTP is not a secure context, so navigator.clipboard may not exist there — the
// same reasoning as TokenLinkField. `type="button"` matters: this renders inside the login <form>.
function DiagRefChip({ value }: { value: string }) {
  const { t } = useTranslation();
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  const selectAndCopy = (): void => {
    const node = codeRef.current;
    if (node) window.getSelection()?.selectAllChildren(node);
    void navigator.clipboard
      ?.writeText(value)
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <div className={styles.refRow}>
      <span className={styles.refLabel}>{t('login.refLabel')}</span>
      <code ref={codeRef} className={styles.refCode} onClick={selectAndCopy}>
        {value}
      </code>
      <button type="button" className={styles.refCopy} onClick={selectAndCopy}>
        {t(copied ? 'login.refCopied' : 'login.refCopy')}
      </button>
    </div>
  );
}

export function StateAlert({
  state,
  failure,
  lockSeconds,
}: {
  state: LoginState;
  failure: LoginFailure;
  lockSeconds: number;
}) {
  const { t } = useTranslation();

  if (state === 'error')
    return (
      <div
        className={failure.ref ? `${styles.alert} ${styles.alertWithRef}` : styles.alert}
        role="alert"
      >
        <span>{t(ERROR_KEY[failure.kind])}</span>
        {failure.ref && <DiagRefChip value={failure.ref} />}
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
