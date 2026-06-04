// Pure scale helpers for the inline SVG charts (design/components/charts.md). No React,
// no tokens — just the linear maps and domain padding the chart needs to place points.

export interface ChartBox {
  w: number;
  h: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
}

/** Default weight-chart frame (viewBox 0 0 740 280, room for both axes). */
export const WEIGHT_BOX: ChartBox = { w: 740, h: 280, padL: 40, padR: 40, padT: 14, padB: 26 };

/** Parse an ISO date to epoch ms (chart x values). */
export const toMs = (date: string): number => Date.parse(date);

/** Linear map [d0,d1] → [r0,r1]; a zero-width domain collapses to the range start. */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0 || 1;
  return (v: number): number => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Padded [min,max] over the values (default 6% headroom); guards empty/equal inputs. */
export function niceDomain(values: number[], pad = 0.06): [number, number] {
  if (values.length === 0) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const margin = (max - min) * pad;
  return [min - margin, max + margin];
}

/** Build an SVG path "M x,y L x,y …" from points already projected to pixels. */
export function polyline(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}
