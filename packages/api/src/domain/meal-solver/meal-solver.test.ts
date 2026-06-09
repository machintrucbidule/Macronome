import { describe, expect, test } from 'vitest';
import { computeRemaining } from './remaining.js';
import { penalty } from './penalty.js';
import { aggregate, itemSnap, verifyProposal } from './verify.js';
import type {
  DayContext,
  Macros,
  SolverCandidate,
  SolvedQuantity,
  TargetSnapshot,
} from './types.js';

// Neutral CI oracles from spec/logic/meal-solver.md §6. Synthetic candidate table; note F3's
// stored kcal 60 ≠ its macro arithmetic (9·0 + 4·4 + 4·10 = 56), exercising the calorie-axis rule.
const PER100G: Record<string, Macros> = {
  F1: { kcal: 110, protein: 23, fat: 2, carb: 0 }, // Blanc de poulet (5 g step)
  F2: { kcal: 900, protein: 0, fat: 100, carb: 0 }, // Huile d'olive
  F3: { kcal: 60, protein: 10, fat: 0, carb: 4 }, // Yaourt grec 0%
  F4: { kcal: 400, protein: 80, fat: 8, carb: 4 }, // Whey, dose 30 g
  F5: { kcal: 140, protein: 12, fat: 10, carb: 1 }, // Œuf, 57 g
  F6: { kcal: 600, protein: 21, fat: 50, carb: 20 }, // Amandes
  F7: { kcal: 20, protein: 2, fat: 0, carb: 3 }, // Courgette
  F8: { kcal: 52, protein: 0, fat: 0, carb: 14 }, // Pomme, 150 g
};

const PORTION_GRAMS: Record<string, number> = { F4: 30, F5: 57, F8: 150 };

const TARGETS: TargetSnapshot = {
  cal_min: 1550,
  cal_max: 1650,
  protein_floor_g: 140,
  fat_floor_g: 50,
  carb_ceiling_g: 150,
};
const ENTERED: Macros = { kcal: 920, protein: 78, fat: 28, carb: 70 };
const CTX: DayContext = { targets: TARGETS, entered: ENTERED };

/** Build a candidate; pass `portionLabel` to make it portioned (grams from PORTION_GRAMS). */
function candidate(id: string, portionLabel?: string): SolverCandidate {
  return {
    food_id: id,
    meal_id: 'm1',
    food_name: id,
    rating: 3,
    per100g: PER100G[id]!,
    portion: portionLabel
      ? { portion_id: `${id}-p`, label: portionLabel, grams: PORTION_GRAMS[id]! }
      : null,
  };
}

/** Portionless solved quantity at `grams`. */
function g(id: string, grams: number): SolvedQuantity {
  return { candidate: candidate(id), count: null, grams };
}
/** Portioned solved quantity: `count` whole portions → `count × portion.grams` grams. */
function p(id: string, label: string, count: number): SolvedQuantity {
  const grams = PORTION_GRAMS[id]! * count;
  return { candidate: candidate(id, label), count, grams };
}

describe('remaining (§1)', () => {
  test('day context → rem band + needs + carb room', () => {
    const r = computeRemaining(CTX);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.remaining).toEqual({
      rem_cal_min: 630,
      rem_cal_max: 730,
      need_protein: 62,
      need_fat: 22,
      carb_room: 80,
    });
  });

  test('no calorie band → no_target signal', () => {
    expect(computeRemaining({ targets: { ...TARGETS, cal_min: null }, entered: ENTERED })).toEqual({
      ok: false,
      reason: 'no_target',
    });
    expect(computeRemaining({ targets: { ...TARGETS, cal_max: null }, entered: ENTERED }).ok).toBe(
      false,
    );
  });

  test('null floor / ceiling → dropped (need 0, room null)', () => {
    const r = computeRemaining({
      targets: { ...TARGETS, protein_floor_g: null, carb_ceiling_g: null },
      entered: ENTERED,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.remaining.need_protein).toBe(0);
    expect(r.remaining.carb_room).toBeNull();
  });
});

describe('penalty (§2) — Oracle D, conservative bias', () => {
  // A: best lean fit — fat floor short 3 g; B: forces fat by overshooting calories by 22.
  const dayA: Macros = { kcal: 1585, protein: 175, fat: 47, carb: 105 };
  const dayB: Macros = { kcal: 1672, protein: 160, fat: 52, carb: 100 };

  test('hard penalty: P(A)=24 < P(B)=33 (fat shortfall preferred over calorie overshoot)', () => {
    const a = penalty(dayA, 35, TARGETS);
    const b = penalty(dayB, 30, TARGETS);
    expect(a.hard).toBe(24); // 8 · 3 g fat shortfall
    expect(b.hard).toBe(33); // 1.5 · 22 kcal over
    expect(a.hard).toBeLessThan(b.hard);
    expect(a.total).toBeLessThan(b.total); // tie-break preserves the selection
  });

  test('full fit → hard 0 (calorie-over weighted above calorie-under)', () => {
    const full = penalty({ kcal: 1600, protein: 150, fat: 55, carb: 90 }, 90, TARGETS);
    expect(full.hard).toBe(0);
    // 10 kcal over costs 1.5·10=15 > 10 kcal under (1.0·10=10).
    expect(penalty({ kcal: 1660, protein: 150, fat: 55, carb: 90 }, 90, TARGETS).hard).toBe(15);
    expect(penalty({ kcal: 1540, protein: 150, fat: 55, carb: 90 }, 90, TARGETS).hard).toBe(10);
  });
});

describe('verify (§3–§4)', () => {
  test('Oracle A — full fit, portionless mix', () => {
    const items = [
      g('F1', 200),
      g('F2', 15),
      g('F3', 200),
      p('F4', 'dose', 1),
      g('F6', 10),
      g('F7', 200),
    ];
    const v = verifyProposal(items, CTX);
    expect(v.day_total).toEqual({ kcal: 1615, protein: 174, fat: 54, carb: 87 });
    expect(v.targets_met).toEqual({ calorie: true, protein: true, fat: true, carb: true });
    expect(v.gaps).toEqual([]);
  });

  test('Oracle B — full fit with indivisible portions; served quantities exposed', () => {
    const items = [
      p('F5', 'œuf', 3),
      g('F1', 150),
      p('F4', 'dose', 1),
      p('F8', 'pomme', 1),
      g('F6', 5),
    ];
    const v = verifyProposal(items, CTX);
    expect(v.day_total).toEqual({ kcal: 1552, protein: 158, fat: 53, carb: 95 });
    expect(v.targets_met).toEqual({ calorie: true, protein: true, fat: true, carb: true });
    expect(v.gaps).toEqual([]);

    const egg = v.items.find((i) => i.food_id === 'F5')!;
    expect(egg).toMatchObject({ served_quantity: 3, unit: 'portion', served_grams: 171 });
    const apple = v.items.find((i) => i.food_id === 'F8')!;
    expect(apple).toMatchObject({ served_quantity: 1, unit: 'portion', served_grams: 150 });
    const chicken = v.items.find((i) => i.food_id === 'F1')!;
    expect(chicken).toMatchObject({ served_quantity: 150, unit: 'g', served_grams: 150 });
  });

  test('calorie-axis basis — F3 uses stored kcal 60, not 9/4/4 arithmetic (56)', () => {
    expect(itemSnap(PER100G.F3!, 100).kcal).toBe(60);
    const { dayAgg } = aggregate([g('F3', 100)], ENTERED);
    expect(dayAgg.kcal).toBe(980); // 920 + 60 (not 920 + 56)
  });

  test('closest fit — fat-floor short surfaces a gap, calorie/protein met', () => {
    // Lean day: fat 47 (floor 50, short 3), everything else in range.
    const ctx: DayContext = {
      targets: TARGETS,
      entered: { kcal: 1585, protein: 175, fat: 47, carb: 105 },
    };
    const v = verifyProposal([], ctx);
    expect(v.targets_met).toEqual({ calorie: true, protein: true, fat: false, carb: true });
    expect(v.gaps).toEqual([{ target: 'fat_floor', short_g: 3 }]);
  });
});
