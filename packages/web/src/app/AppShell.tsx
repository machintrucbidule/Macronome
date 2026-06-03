import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from './ThemeToggle';
import styles from './AppShell.module.css';

// In-app frame: appbar (wordmark + theme toggle) + page body. The full primary nav
// and account menu arrive with their screens in later milestones.
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div>
      <header className={styles.appbar}>
        <span className={styles.wordmark}>{t('app.title')}</span>
        <span className={styles.spacer} />
        <ThemeToggle />
      </header>
      <main className={styles.page}>{children}</main>
    </div>
  );
}
