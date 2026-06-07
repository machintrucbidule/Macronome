import { useTranslation } from 'react-i18next';
import styles from './Chart.module.css';

// Generic chart legend (design/components/charts.md §Shared "legend"). Each series colour
// is set inline from its theme token; the swatch shape (line / dash / dot) comes from CSS.
// Callers pass their own series list (weight chart, stats bars, …).
export interface Series {
  shape: 'line' | 'dash' | 'dot';
  token: string;
  labelKey: string;
}

export function ChartLegend({ series }: { series: Series[] }) {
  const { t } = useTranslation();
  return (
    <div className={styles.legend}>
      {series.map((s) => (
        <span key={s.labelKey} className={styles.legendItem}>
          <span className={styles[s.shape]} style={{ color: `var(${s.token})` }} />
          {t(s.labelKey)}
        </span>
      ))}
    </div>
  );
}
