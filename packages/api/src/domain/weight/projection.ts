// Goal-date projection (spec/logic/weight-periods-trajectory.md §6). Opt-in: only when a
// goal weight is set and not in Maintien mode. A line is fit to the RECENT EMA points
// (the caller supplies the window — default last 4 weigh-ins, ≥2 required) with x in days
// and y in kg; `slope` is kg/day. This pure function returns the status + days-to-goal;
// the service turns days into a calendar date (it owns the latest weigh-in date).

export type ProjectionStatus = 'projected' | 'non_baissiere' | 'atteint' | 'no_goal';

export interface ProjectionPoint {
  /** Day offset (x); any consistent origin works — only the slope matters. */
  x: number;
  /** EMA weight (y) in kg. */
  y: number;
}

export interface ProjectionInput {
  /** Recent EMA points (already windowed by the caller). */
  points: ProjectionPoint[];
  goalWeight: number | null;
  /** Maintien mode gates off any loss projection (§6, §7). */
  maintien: boolean;
}

export interface ProjectionResult {
  status: ProjectionStatus;
  /** Days from the latest weigh-in to the goal; null unless status is 'projected'. */
  days: number | null;
}

/** Ordinary-least-squares slope (kg/day); 0 when the x's are degenerate. */
function leastSquaresSlope(points: ProjectionPoint[]): number {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    numerator += (p.x - meanX) * (p.y - meanY);
    denominator += (p.x - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Project the goal date from the recent EMA trend (no projection → 'no_goal'/'non_baissiere'). */
export function projectGoalDate({
  points,
  goalWeight,
  maintien,
}: ProjectionInput): ProjectionResult {
  if (goalWeight === null || maintien || points.length < 2) {
    return { status: 'no_goal', days: null };
  }
  const slope = leastSquaresSlope(points);
  const currentEma = points[points.length - 1]!.y;
  if (slope >= 0) return { status: 'non_baissiere', days: null };
  if (currentEma <= goalWeight) return { status: 'atteint', days: null };
  return { status: 'projected', days: (currentEma - goalWeight) / -slope };
}
