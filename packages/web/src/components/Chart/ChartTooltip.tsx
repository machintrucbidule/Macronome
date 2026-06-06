import type { ChartBox } from './scale';
import styles from './Chart.module.css';

// Styled weight-chart tooltip (B-056; design/components/charts.md §Shared primitives:
// the weight chart uses a styled HTML card instead of the native <title>). Positioned as a
// percentage of the chart box, which maps 1:1 to the viewBox because the SVG renders at
// width:100% / height:auto / xMidYMid meet (no letterboxing). Pure presentation.
export interface TooltipPoint {
  cx: number;
  cy: number;
  tip: string;
}

export function ChartTooltip({ point, box }: { point: TooltipPoint; box: ChartBox }) {
  return (
    <div
      className={styles.tooltip}
      style={{ left: `${(point.cx / box.w) * 100}%`, top: `${(point.cy / box.h) * 100}%` }}
      role="status"
    >
      {point.tip}
    </div>
  );
}
