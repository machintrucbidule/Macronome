import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLogin } from './useLogin';

// Minimal pre-auth login screen (own top-bar per theming.md). Submission is wired in M8
// (session + redirect home); the lockout/countdown and detailed states are M9 polish.
export function LoginPage() {
  const { t } = useTranslation();
  const { submit, pending, failed } = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    void submit(username, password);
  }

  return (
    <main>
      <h1>{t('login.title')}</h1>
      <form onSubmit={onSubmit}>
        <label>
          {t('login.username')}
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          {t('login.password')}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {failed && <p role="alert">{t('login.error')}</p>}
        <button type="submit" disabled={pending}>
          {t('login.submit')}
        </button>
      </form>
    </main>
  );
}
