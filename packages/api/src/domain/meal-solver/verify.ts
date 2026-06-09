// The verifier (spec/logic/meal-solver.md §3–§4, B-123). Pure. Whatever quantities the solver
// returns, recompute the day total IN CODE from the chosen quantities and derive the fit + gaps —
// the "fits the targets" claim is never trusted from the LLM. Uses the calorie-axis basis (each
// food's stored `kcal_per_100g`, never 9·fat+4·carb+4·protein) so the verified total equals what
// the app will actually store after apply (§2 critical correctness rule).
import type { DayContext, Macros, SolvedQuantity, TargetSnapshot } from './types.js';

/** One verified proposal line, shaped to feed `MealProposalItemSchema` (S8). `snap` is full
 *  precision (the server stores full precision; the web rounds at render). */
export interface VerifiedItem {
  food_id: string;
  food_name: string;
  meal_id: string;
  portion_id: string | null;
  portion_label: string | null;
  served_quantity: number;
  unit: 'g' | 'portion';
  served_grams: number;
  snap: Macros;
  rating: SolvedQuantity['candidate']['rating'];
}

export interface TargetsMet {
  calorie: boolean;
  protein: boolean;
  fat: boolean;
  carb: boolean;
}

export type Gap =
  | { target: 'protein_floor' | 'fat_floor'; short_g: number }
  | { target: 'calorie'; delta_kcal: number };

/** A fully-verified proposal: its items, the display-rounded certified day total, the per-axis
 *  booleans, and the user-facing gaps. Does NOT carry `fit` — that is read off `penalty().hard`
 *  by the solver/service (S5/S8). */
export interface VerifiedProposal {
  items: VerifiedItem[];
  day_total: Macros;
  targets_met: TargetsMet;
  gaps: Gap[];
}

/** Per-food macro contribution at `grams`: per-100 g values scaled by grams/100 (full precision,
 *  calorie-axis basis). */
export function itemSnap(per100g: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: per100g.kcal * f,
    protein: per100g.protein * f,
    fat: per100g.fat * f,
    carb: per100g.carb * f,
  };
}

/** Day aggregate (entered + Σ contributions) and the proposal's added carb (the penalty
 *  tie-break basis). Full precision. Reused by solve.ts (S5) to feed `penalty`. */
export function aggregate(
  items: SolvedQuantity[],
  entered: Macros,
): { dayAgg: Macros; addedCarb: number } {
  const dayAgg: Macros = { ...entered };
  let addedCarb = 0;
  for (const { candidate, grams } of items) {
    const snap = itemSnap(candidate.per100g, grams);
    dayAgg.kcal += snap.kcal;
    dayAgg.protein += snap.protein;
    dayAgg.fat += snap.fat;
    dayAgg.carb += snap.carb;
    addedCarb += snap.carb;
  }
  return { dayAgg, addedCarb };
}

/** Recompute and certify a proposal from its solved quantities. */
export function verifyProposal(items: SolvedQuantity[], ctx: DayContext): VerifiedProposal {
  const { entered, targets } = ctx;
  const verifiedItems = items.map(toVerifiedItem);
  const { dayAgg } = aggregate(items, entered);

  return {
    items: verifiedItems,
    day_total: {
      kcal: roundHalfUp(dayAgg.kcal),
      protein: roundHalfUp(dayAgg.protein),
      fat: roundHalfUp(dayAgg.fat),
      carb: roundHalfUp(dayAgg.carb),
    },
    targets_met: deriveTargetsMet(dayAgg, targets),
    gaps: deriveGaps(dayAgg, targets),
  };
}

function toVerifiedItem({ candidate, count, grams }: SolvedQuantity): VerifiedItem {
  const portioned = candidate.portion != null;
  return {
    food_id: candidate.food_id,
    food_name: candidate.food_name,
    meal_id: candidate.meal_id,
    portion_id: candidate.portion?.portion_id ?? null,
    portion_label: candidate.portion?.label ?? null,
    served_quantity: portioned ? (count ?? 0) : grams,
    unit: portioned ? 'portion' : 'g',
    served_grams: grams,
    snap: itemSnap(candidate.per100g, grams),
    rating: candidate.rating,
  };
}

/** Per-axis pass/fail from the full-precision day aggregate (a dropped null target ⇒ satisfied). */
function deriveTargetsMet(dayAgg: Macros, t: TargetSnapshot): TargetsMet {
  return {
    calorie:
      (t.cal_min == null || dayAgg.kcal >= t.cal_min) &&
      (t.cal_max == null || dayAgg.kcal <= t.cal_max),
    protein: t.protein_floor_g == null || dayAgg.protein >= t.protein_floor_g,
    fat: t.fat_floor_g == null || dayAgg.fat >= t.fat_floor_g,
    carb: t.carb_ceiling_g == null || dayAgg.carb <= t.carb_ceiling_g,
  };
}

/** User-facing residuals. Carb-over the ceiling is never a gap (soft; shown informationally). */
function deriveGaps(dayAgg: Macros, t: TargetSnapshot): Gap[] {
  const gaps: Gap[] = [];
  if (t.protein_floor_g != null && dayAgg.protein < t.protein_floor_g) {
    gaps.push({
      target: 'protein_floor',
      short_g: roundHalfUp(t.protein_floor_g - dayAgg.protein),
    });
  }
  if (t.fat_floor_g != null && dayAgg.fat < t.fat_floor_g) {
    gaps.push({ target: 'fat_floor', short_g: roundHalfUp(t.fat_floor_g - dayAgg.fat) });
  }
  if (t.cal_max != null && dayAgg.kcal > t.cal_max) {
    gaps.push({ target: 'calorie', delta_kcal: roundHalfUp(dayAgg.kcal - t.cal_max) });
  } else if (t.cal_min != null && dayAgg.kcal < t.cal_min) {
    gaps.push({ target: 'calorie', delta_kcal: roundHalfUp(dayAgg.kcal - t.cal_min) });
  }
  return gaps;
}

/** Round half-up to an integer (00-conventions.md display rounding; consistent for both signs). */
function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}
