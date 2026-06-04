import { useTranslation } from 'react-i18next';
import type { WeightRange } from '@macronome/shared';
import styles from './Chart.module.css';

// Segmented range control (design/components/charts.md §Weight chart "rangeseg"). Clips
// the chart only; the trend/trajectory are computed server-side on the full history.
const RANGES: WeightRange[] = ['3m', '6m', '1y', 'all'];

interface RangeControlProps {
  range: WeightRange;
  onRange: (r: WeightRange) => void;
}

export function RangeControl({ range, onRange }: RangeControlProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.rangeseg} role="group">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          className={r === range ? styles.rangeOn : styles.rangeBtn}
          aria-pressed={r === range}
          onClick={() => onRange(r)}
        >
          {t(`weight.range.${r}`)}
        </button>
      ))}
    </div>
  );
}
