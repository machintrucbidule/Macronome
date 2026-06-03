import { useTranslation } from 'react-i18next';

// Minimal pre-auth login screen (own top-bar per theming.md). The full login flow
// (submission, lockout/countdown states) is built in a later milestone.
export function LoginPage() {
  const { t } = useTranslation();
  return (
    <main>
      <h1>{t('login.title')}</h1>
      <form>
        <label>
          {t('login.username')}
          <input name="username" autoComplete="username" />
        </label>
        <label>
          {t('login.password')}
          <input name="password" type="password" autoComplete="current-password" />
        </label>
        <button type="submit">{t('login.submit')}</button>
      </form>
    </main>
  );
}
