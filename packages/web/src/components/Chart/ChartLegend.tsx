import { useTranslation } from 'react-i18next';
import styles from './Chart.module.css';

// Weight-chart legend (design/components/charts.md §Shared "legend"). Each series colour
// is set inline from its theme token; the swatch shape (line / dash / dot) comes from CSS.
interface Series {
  shape: 'line' | 'dash' | 'dot';
  token: string;
  labelKey: string;
}

const BASE: Series[] = [
  { shape: 'dot', token: '--weight', labelKey: 'weight.legend.weighed' },
  { shape: 'line', token: '--trend', labelKey: 'weight.legend.trend' },
  { shape: 'dash', token: '--traj', labelKey: 'weight.legend.trajectory' },
  { shape: 'dash', token: '--ok', labelKey: 'weight.legend.goal' },
];
const WAIST: Series = { shape: 'line', token: '--waistc', labelKey: 'weight.legend.waist' };

export function ChartLegend({ showWaist }: { showWaist: boolean }) {
  const { t } = useTranslation();
  const series = showWaist ? [...BASE, WAIST] : BASE;
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
