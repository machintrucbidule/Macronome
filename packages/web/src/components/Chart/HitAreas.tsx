import type { TipContent } from './ChartTooltip';
import styles from './Chart.module.css';

// Transparent point hit-areas (B-018): the visible weight/waist dots are intentionally tiny
// (design spec), so these larger invisible circles make a point hoverable. Rendered last (on
// top of the curves) so a hover near a point always lands on it. Hovering surfaces the styled
// tooltip (B-056) via the callbacks — the native <title> is gone.
export interface HitPoint {
  id: string;
  cx: number;
  cy: number;
  tip: TipContent;
}

interface HitAreasProps {
  points: HitPoint[];
  onHover: (point: HitPoint) => void;
  onLeave: () => void;
}

export function HitAreas({ points, onHover, onLeave }: HitAreasProps) {
  return (
    <>
      {points.map((p) => (
        <circle
          className={styles.hit}
          key={p.id}
          cx={p.cx}
          cy={p.cy}
          r={8}
          aria-hidden="true"
          onMouseEnter={() => onHover(p)}
          onMouseLeave={onLeave}
        />
      ))}
    </>
  );
}
