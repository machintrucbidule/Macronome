import { type ChartBox, ticks } from './scale';
import styles from './Chart.module.css';

// Horizontal value gridlines + left-axis labels for the inline bar charts
// (design/components/charts.md §Stats bars, B-112). Mirrors the weight-chart axes
// treatment. Pure projection — no nutrition computation here.
export function ChartGridlines({
  box: B,
  lo,
  hi,
  y,
}: {
  box: ChartBox;
  lo: number;
  hi: number;
  y: (v: number) => number;
}) {
  return (
    <g aria-hidden="true">
      {ticks(lo, hi).map((v) => (
        <g key={v}>
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
    </g>
  );
}
