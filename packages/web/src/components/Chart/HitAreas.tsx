import styles from './Chart.module.css';

// Transparent point hit-areas (B-018): the visible weight/waist dots are intentionally tiny
// (design spec), so these larger invisible circles make the native <title> tooltip reachable.
// Rendered last (on top of the curves) so a hover near a point always lands on the title.
export interface HitPoint {
  id: string;
  cx: number;
  cy: number;
  tip: string;
}

export function HitAreas({ points }: { points: HitPoint[] }) {
  return (
    <>
      {points.map((p) => (
        <circle className={styles.hit} key={p.id} cx={p.cx} cy={p.cy} r={8}>
          <title>{p.tip}</title>
        </circle>
      ))}
    </>
  );
}
