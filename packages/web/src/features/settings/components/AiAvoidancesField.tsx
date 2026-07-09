import { useTranslation } from 'react-i18next';
import styles from '../settings.module.css';

// Allergies / disliked foods (B-216). Connection-level free text, rendered just under the advice
// (Conseils) task block. Sent to BOTH the advice and meal-suggestions models so neither proposes
// these foods. Controlled draft held in useAiConnectionForm; saved with the rest on "Enregistrer".
interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function AiAvoidancesField({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <div className={styles.aiTask}>
      <div className={styles.aiTaskName}>{t('settings.ai.avoidances')}</div>
      <label className={styles.aiField}>
        <textarea
          className={styles.aiTextarea}
          rows={3}
          value={value}
          aria-label={t('settings.ai.avoidances')}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className={styles.aiNote}>{t('settings.ai.avoidancesNote')}</span>
      </label>
    </div>
  );
}
