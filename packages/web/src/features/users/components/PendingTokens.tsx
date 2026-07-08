import { useTranslation } from 'react-i18next';
import type { AccountTokenSummary } from '@macronome/shared';
import { formatInstant } from '../format';
import styles from '../users.module.css';

// « Liens en attente » (screens/users.md, B-193/194): every pending invitation /
// password-reset link — type, role or target, created, expires, revoke (× —
// immediate, links are cheap to regenerate). Rendered in both desktop and mobile
// trees; the token secret itself is never listed.
export function PendingTokens({
  tokens,
  onRevoke,
}: {
  tokens: AccountTokenSummary[];
  onRevoke: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <section className={styles.tokensSection}>
      <h2 className={styles.tokensTitle}>{t('users.links.title')}</h2>
      {tokens.length === 0 ? (
        <p className={styles.tokensEmpty}>{t('users.links.empty')}</p>
      ) : (
        <ul className={styles.tokensList}>
          {tokens.map((tok) => (
            <li key={tok.id} className={styles.tokenRow}>
              <span className={styles.tokenKind}>
                {t(tok.kind === 'invite' ? 'users.links.invite' : 'users.links.reset')}
              </span>
              <span className={styles.tokenWho}>
                {tok.kind === 'invite'
                  ? t(tok.is_admin ? 'account.typeAdmin' : 'account.typeUser')
                  : (tok.username ?? '—')}
              </span>
              <span className={styles.tokenDates}>
                {t('users.links.expires', { date: formatInstant(tok.expires_at, i18n.language) })}
              </span>
              <button
                type="button"
                className={styles.del}
                title={t('users.links.revoke')}
                onClick={() => onRevoke(tok.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
