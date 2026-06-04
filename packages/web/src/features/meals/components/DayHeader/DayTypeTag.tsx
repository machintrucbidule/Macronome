import { useTranslation } from 'react-i18next';
import styles from '../../meals.module.css';

// Day-type pill: detailed vs summary (imported). Summary days render the reduced read-only
// layout elsewhere; here it only labels the kind.
export function DayTypeTag({ kind }: { kind: 'detailed' | 'summary' }) {
  const { t } = useTranslation();
  return <span className={styles.dayTag}>{t(`meals.dayType.${kind}`)}</span>;
}
