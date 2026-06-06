import { useTranslation } from 'react-i18next';
import { monthLabel } from '../../features/stats/format';
import { type ChartBox, ticks } from './scale';
import styles from './Chart.module.css';

// Axes + gridlines for the weight chart (design/components/charts.md §Shared primitives:
// .gridline + .axislbl). Drawn behind the curves. Semantic tokens only; pure projection —
// no nutrition computation here. Left axis = weight (kg), right axis = waist (cm, when on),
// bottom axis = month labels across the date domain.
interface ChartAxesProps {
  box: ChartBox;
  yDomain: [number, number];
  y: (v: number) => number;
  xDomain: [number, number];
  x: (v: number) => number;
  showWaist: boolean;
  wDomain: [number, number];
  wy: (v: number) => number;
}

export function ChartAxes(props: ChartAxesProps) {
  const { box: B, yDomain, y, xDomain, x, showWaist, wDomain, wy } = props;
  const { i18n } = useTranslation();
  return (
    <g aria-hidden="true">
      {ticks(yDomain[0], yDomain[1]).map((v) => (
        <g key={`y${v}`}>
          <line className={styles.gridline} x1={B.padL} x2={B.w - B.padR} y1={y(v)} y2={y(v)} />
          <text
            className={styles.axislbl}
            x={B.padL - 4}
            y={y(v)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {Math.round(v)}
          </text>
        </g>
      ))}
      {showWaist &&
        ticks(wDomain[0], wDomain[1]).map((v) => (
          <text
            key={`w${v}`}
            className={`${styles.axislbl} ${styles.axislblWaist}`}
            x={B.w - B.padR + 4}
            y={wy(v)}
            textAnchor="start"
            dominantBaseline="middle"
          >
            {Math.round(v)}
          </text>
        ))}
      {ticks(xDomain[0], xDomain[1]).map((v) => (
        <text key={`x${v}`} className={styles.axislbl} x={x(v)} y={B.h - 6} textAnchor="middle">
          {monthLabel(new Date(v).getMonth() + 1, i18n.language)}
        </text>
      ))}
    </g>
  );
}
