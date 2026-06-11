import { svgPointToClient } from './anchor';
import type { TooltipAnchor, TooltipPoint } from './ChartTooltip';
import styles from './Chart.module.css';

// Transparent per-column hit-areas for the inline bar charts: one full-height band per
// month surfaces the styled tooltip on hover (B-111, mirrors the weight chart's HitAreas).
// Pure presentation.
export interface ColumnHit {
  /** Left x of the column band (viewBox units). */
  x: number;
  /** Tooltip anchor + text surfaced while hovering this column. */
  point: TooltipPoint;
}

export function ColumnHits({
  columns,
  width,
  top,
  height,
  onHover,
  onLeave,
}: {
  columns: ColumnHit[];
  width: number;
  top: number;
  height: number;
  onHover: (anchor: TooltipAnchor) => void;
  onLeave: () => void;
}) {
  return (
    <>
      {columns.map((c) => (
        <rect
          key={c.x}
          className={styles.hit}
          x={c.x}
          y={top}
          width={width}
          height={height}
          onMouseEnter={(e) => {
            const a = svgPointToClient(e.currentTarget, c.point.cx, c.point.cy);
            if (a) onHover({ ...a, tip: c.point.tip });
          }}
          onMouseLeave={onLeave}
        />
      ))}
    </>
  );
}
