// The solver search (spec/logic/meal-solver.md §2, B-123). Pure + deterministic. Given the
// LLM-picked candidate foods + the day context, set each food's quantity (integer portion count
// for a portioned food, 5 g-step grams for a portionless one) to minimise the penalty P(q) over
// the day's hard/soft targets. Exhaustive enumeration when the grid is small enough
// (≤ SOLVER_ENUM_BUDGET combinations); otherwise deterministic coordinate descent from a
// proportional-scaling seed. Honours pinned (fixed) + excluded foods (§2.6). The LLM is never
// trusted for arithmetic — this only produces quantities; verify.ts recomputes & certifies them.
import { MAX_PORTION_COUNT, PORTIONLESS_GRAM_STEP, SOLVER_ENUM_BUDGET } from '@macronome/shared';
import { penalty } from './penalty.js';
import { aggregate } from './verify.js';
import type { DayContext, SolverCandidate, SolvedQuantity } from './types.js';

/** A user-pinned quantity (refine loop, §2.6): the matching candidate is held fixed here while
 *  the free variables are fitted around it. Grams are resolved to a whole count for a portioned
 *  food. */
export interface PinnedQuantity {
  food_id: string;
  meal_id: string;
  portion_id: string | null;
  grams: number;
}

export interface SolveInput {
  candidates: SolverCandidate[];
  ctx: DayContext;
  /** Refine pins — each fixes its matching candidate's quantity (§2.6). */
  pinned?: PinnedQuantity[];
  /** Refine exclusions — defensively dropped here too (normally already out of the pool, §2.6). */
  excludedFoodIds?: string[];
}

/** Absolute gram cap for a (near-)zero-kcal food, where the rem_cal_max-derived cap is unbounded. */
const FALLBACK_CAP_GRAMS = 1000;
/** kcal/100g at/below which a food is treated as zero-calorie for cap derivation. */
const MIN_KCAL_DENSITY = 1;
/** Coordinate-descent pass ceiling — a backstop; convergence is typically a handful of passes. */
const MAX_DESCENT_PASSES = 100;

/** A free decision variable: its value is an integer `units` in [0, maxUnits]; grams = units·step.
 *  A portioned food's unit is one whole portion (step = portion.grams); a portionless food's unit
 *  is one 5 g grams-step. This unifies both kinds behind a single discrete search. */
interface Variable {
  candidate: SolverCandidate;
  portioned: boolean;
  step: number;
  maxUnits: number;
}

type Slot = { kind: 'fixed'; q: SolvedQuantity } | { kind: 'free'; index: number };

/** Solve a candidate set into quantities minimising P(q). Returns one SolvedQuantity per
 *  candidate (after excludes), in the original candidate order, for verify.ts to certify. */
export function solve(input: SolveInput): SolvedQuantity[] {
  const { ctx } = input;
  const excluded = new Set(input.excludedFoodIds ?? []);
  const candidates = input.candidates.filter((c) => !excluded.has(c.food_id));
  const pins = input.pinned ?? [];

  const remCalMax = ctx.targets.cal_max == null ? Infinity : ctx.targets.cal_max - ctx.entered.kcal;
  const alreadyOver = ctx.targets.cal_max != null && remCalMax < 0;

  // Partition into pinned (fixed) and free variables, remembering each candidate's original slot.
  const fixed: SolvedQuantity[] = [];
  const vars: Variable[] = [];
  const slots: Slot[] = candidates.map((c) => {
    const pin = matchPin(c, pins);
    if (pin) {
      const q = fixedQuantity(c, pin.grams);
      fixed.push(q);
      return { kind: 'fixed', q };
    }
    const slot: Slot = { kind: 'free', index: vars.length };
    vars.push(makeVariable(c, remCalMax));
    return slot;
  });

  // §2.1 "Already over": if the day is past cal_max, the only feasible move is to add nothing.
  const units = alreadyOver ? vars.map(() => 0) : search(vars, fixed, ctx);

  return slots.map((s) =>
    s.kind === 'fixed' ? s.q : varQuantity(vars[s.index]!, units[s.index]!),
  );
}

/** Find the pin (if any) matching this candidate by food + meal + chosen portion. */
function matchPin(c: SolverCandidate, pins: PinnedQuantity[]): PinnedQuantity | undefined {
  const portionId = c.portion?.portion_id ?? null;
  return pins.find(
    (p) =>
      p.food_id === c.food_id && p.meal_id === c.meal_id && (p.portion_id ?? null) === portionId,
  );
}

/** A fixed (pinned) quantity: a portioned food snaps grams to whole portions, indivisibly. */
function fixedQuantity(c: SolverCandidate, grams: number): SolvedQuantity {
  if (c.portion) {
    const count = Math.round(grams / c.portion.grams);
    return { candidate: c, count, grams: count * c.portion.grams };
  }
  return { candidate: c, count: null, grams };
}

/** Build the discrete decision variable for a free candidate. */
function makeVariable(c: SolverCandidate, remCalMax: number): Variable {
  if (c.portion) {
    return { candidate: c, portioned: true, step: c.portion.grams, maxUnits: MAX_PORTION_COUNT };
  }
  const cap = capGrams(c.per100g.kcal, remCalMax);
  return {
    candidate: c,
    portioned: false,
    step: PORTIONLESS_GRAM_STEP,
    maxUnits: Math.floor(cap / PORTIONLESS_GRAM_STEP),
  };
}

/** Per-food gram cap, derived from rem_cal_max (the food alone may not exceed the remaining max
 *  kcal), snapped down to a 5 g step. A (near-)zero-kcal food has no kcal-derived bound, so it is
 *  bounded by an absolute fallback instead of running away. */
function capGrams(kcalPer100g: number, remCalMax: number): number {
  if (!Number.isFinite(remCalMax) || kcalPer100g <= MIN_KCAL_DENSITY) return FALLBACK_CAP_GRAMS;
  if (remCalMax <= 0) return 0;
  const raw = (remCalMax / kcalPer100g) * 100;
  return Math.floor(raw / PORTIONLESS_GRAM_STEP) * PORTIONLESS_GRAM_STEP;
}

/** Materialise a variable at an integer `units` value into a SolvedQuantity. */
function varQuantity(v: Variable, units: number): SolvedQuantity {
  return { candidate: v.candidate, count: v.portioned ? units : null, grams: units * v.step };
}

/** Choose enumeration vs coordinate descent by the size of the Cartesian product. */
function search(vars: Variable[], fixed: SolvedQuantity[], ctx: DayContext): number[] {
  if (vars.length === 0) return [];
  return productExceeds(vars, SOLVER_ENUM_BUDGET)
    ? descend(vars, fixed, ctx)
    : enumerate(vars, fixed, ctx);
}

/** Does the Cartesian product of the variable domains exceed `budget`? (Short-circuits without
 *  overflowing on huge domains.) */
function productExceeds(vars: Variable[], budget: number): boolean {
  let product = 1;
  for (const v of vars) {
    product *= v.maxUnits + 1;
    if (product > budget) return true;
  }
  return false;
}

/** P(q).total for a units vector (the deterministic objective: hard terms + the carb tie-break). */
function cost(vars: Variable[], units: number[], fixed: SolvedQuantity[], ctx: DayContext): number {
  const items = fixed.concat(vars.map((v, i) => varQuantity(v, units[i]!)));
  const { dayAgg, addedCarb } = aggregate(items, ctx.entered);
  return penalty(dayAgg, addedCarb, ctx.targets).total;
}

/** Exhaustive enumeration → the global argmin. First-found wins ties (strict `<`) over the fixed
 *  odometer order ⇒ deterministic. */
function enumerate(vars: Variable[], fixed: SolvedQuantity[], ctx: DayContext): number[] {
  const units = vars.map(() => 0);
  let best = units.slice();
  let bestCost = cost(vars, units, fixed, ctx);
  while (increment(units, vars)) {
    const c = cost(vars, units, fixed, ctx);
    if (c < bestCost) {
      bestCost = c;
      best = units.slice();
    }
  }
  return best;
}

/** Advance the odometer (variable 0 fastest); false once it wraps past the last combination. */
function increment(units: number[], vars: Variable[]): boolean {
  for (let i = 0; i < units.length; i++) {
    if (units[i]! < vars[i]!.maxUnits) {
      units[i]!++;
      return true;
    }
    units[i] = 0;
  }
  return false;
}

/** Deterministic coordinate descent from a proportional-scaling seed → a local argmin. Each
 *  coordinate is exactly line-searched over its full discrete domain (holding the others fixed);
 *  strict-`<` improvement (lowest value wins ties) keeps the path — and the output — reproducible. */
function descend(vars: Variable[], fixed: SolvedQuantity[], ctx: DayContext): number[] {
  const units = seed(vars, fixed, ctx);
  for (let pass = 0; pass < MAX_DESCENT_PASSES; pass++) {
    let changed = false;
    for (let i = 0; i < vars.length; i++) {
      const before = units[i]!;
      let bestU = 0;
      let bestC = Infinity;
      for (let u = 0; u <= vars[i]!.maxUnits; u++) {
        units[i] = u;
        const c = cost(vars, units, fixed, ctx);
        if (c < bestC) {
          bestC = c;
          bestU = u;
        }
      }
      units[i] = bestU;
      if (bestU !== before) changed = true;
    }
    if (!changed) break;
  }
  return units;
}

/** Proportional-scaling seed: aim the free foods' combined raw kcal at the midpoint of the
 *  remaining calorie band (net of any pinned contribution), split evenly across the free foods. */
function seed(vars: Variable[], fixed: SolvedQuantity[], ctx: DayContext): number[] {
  const { targets, entered } = ctx;
  const remMin = targets.cal_min == null ? 0 : targets.cal_min - entered.kcal;
  const remMax = targets.cal_max == null ? remMin : targets.cal_max - entered.kcal;
  const midpoint = (remMin + remMax) / 2;
  const fixedKcal = fixed.reduce((sum, q) => sum + (q.candidate.per100g.kcal * q.grams) / 100, 0);
  const share = Math.max(0, midpoint - fixedKcal) / vars.length;
  return vars.map((v) => {
    const kcalPerUnit = (v.candidate.per100g.kcal * v.step) / 100;
    if (kcalPerUnit <= 0) return 0;
    return Math.min(v.maxUnits, Math.max(0, Math.round(share / kcalPerUnit)));
  });
}
