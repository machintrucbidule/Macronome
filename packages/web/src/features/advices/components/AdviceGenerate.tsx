import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../../components/Banner/Banner';
import { mapAiError } from '../../meals/lib/aiError';
import styles from '../advices.module.css';

// Generate control (B-202, block B/E). When the `advice` AI task has no model, show the
// AiNotConfigured state (message + link to Assistant IA) in place of the button. Otherwise a primary
// button (spinner + disabled while the paid call runs) + an inline error banner via the shared AI
// error mapping. The call is on demand; the reply is archived server-side and the list refreshes.
interface AdviceGenerateProps {
  ready: boolean;
  pending: boolean;
  error: unknown;
  onGenerate: () => void;
}

export function AdviceGenerate({ ready, pending, error, onGenerate }: AdviceGenerateProps) {
  const { t } = useTranslation();
  if (!ready) {
    return (
      <p className={styles.notConfigured}>
        {t('advices.notConfigured')} — <Link to="/ai-assistant">{t('advices.configureLink')}</Link>
      </p>
    );
  }
  const err = error ? mapAiError(error) : null;
  return (
    <div className={styles.generate}>
      <button type="button" className={styles.genBtn} disabled={pending} onClick={onGenerate}>
        {pending ? t('advices.generating') : t('advices.generate')}
        {pending && <span className={styles.spinner} aria-hidden="true" />}
      </button>
      {err && (
        <Banner tone="warning">
          {t(`advices.errors.${err.code}`)}
          {err.detail ? ` — ${err.detail}` : ''}
        </Banner>
      )}
    </div>
  );
}
