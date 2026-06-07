import { useTranslation } from 'react-i18next';
import styles from '../journal.module.css';

// Journal day-state legend (JR-1 / B-077, design/components/data-tables.md). Reuses the
// ChartLegend swatch pattern: one small coloured square + label per state. The yellow Partiel
// reuses --accent (no dedicated token; DK-1). The colour is set via the swatch's `color`.
const ITEMS: { token: string; labelKey: string }[] = [
  { token: '--ok', labelKey: 'journal.legend.green' },
  { token: '--accent', labelKey: 'journal.legend.yellow' },
  { token: '--nok', labelKey: 'journal.legend.red' },
];

export function JournalLegend() {
  const { t } = useTranslation();
  return (
    <div className={styles.legend}>
      {ITEMS.map((it) => (
        <span key={it.labelKey} className={styles.legendItem}>
          <span className={styles.swatch} style={{ color: `var(${it.token})` }} />
          {t(it.labelKey)}
        </span>
      ))}
    </div>
  );
}
