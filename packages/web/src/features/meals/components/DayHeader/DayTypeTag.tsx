import { useTranslation } from 'react-i18next';
import styles from '../../meals.module.css';

// Day-type pill: labels the day kind — "Complet" (detailed) vs "Partiel" (summary).
// Internal enum values stay detailed|summary; only the displayed label is Complet/Partiel.
export function DayTypeTag({ kind }: { kind: 'detailed' | 'summary' }) {
  const { t } = useTranslation();
  return <span className={styles.dayTag}>{t(`meals.dayType.${kind}`)}</span>;
}
