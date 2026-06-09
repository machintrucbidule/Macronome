import { describe, expect, it } from 'vitest';
import type { MealProposal, MealProposalItem } from '@macronome/shared';
import {
  accumulateAvoid,
  buildConstraints,
  pinnedFromItem,
  pinnedToBody,
  proposalSignature,
  stepPinned,
  type ExcludedFood,
  type PinnedLine,
} from './refineConstraints';

// AI meal-proposals S11 (B-123): the pure request-shaping helpers behind the refine loop (§2.6).
// Selection only — the day total + fit stay server-certified (CLAUDE.md rule 2).
const SNAP = { kcal: 0, fat: 0, carb: 0, protein: 0 };

const portioned: MealProposalItem = {
  food_id: 'f-egg',
  food_name: 'Œufs',
  meal_id: 'm1',
  portion_id: 'po-egg',
  portion_label: 'œuf',
  served_quantity: 3,
  unit: 'portion',
  served_grams: 171,
  snap: SNAP,
  rating: 3,
};
const portionless: MealProposalItem = {
  food_id: 'f-chk',
  food_name: 'Blanc de poulet',
  meal_id: 'm1',
  portion_id: null,
  portion_label: null,
  served_quantity: 180,
  unit: 'g',
  served_grams: 180,
  snap: SNAP,
  rating: 3,
};

describe('pinnedFromItem + stepPinned', () => {
  it('seeds a portioned pin from per-portion grams and steps by whole portions', () => {
    const pin = pinnedFromItem(portioned);
    expect(pin.unit).toBe('portion');
    expect(pin.count).toBe(3);
    expect(pin.per_portion_grams).toBe(57); // 171 / 3
    const up = stepPinned(pin, 1);
    expect(up.count).toBe(4);
    expect(pinnedToBody(up).grams).toBe(228); // 4 × 57
  });

  it('seeds a portionless pin in grams and steps by 5 g, clamped to one step', () => {
    const pin = pinnedFromItem(portionless);
    expect(pin.count).toBe(180);
    expect(stepPinned(pin, -1).count).toBe(175);
    expect(pinnedToBody(stepPinned(pin, -1)).grams).toBe(175);
  });

  it('clamps a portioned pin to 1..6 portions', () => {
    const one: PinnedLine = { ...pinnedFromItem(portioned), count: 1 };
    expect(stepPinned(one, -1).count).toBe(1);
    const six: PinnedLine = { ...pinnedFromItem(portioned), count: 6 };
    expect(stepPinned(six, 1).count).toBe(6);
  });
});

describe('proposalSignature + accumulateAvoid', () => {
  const make = (id: string, foodIds: string[]): MealProposal => ({
    id,
    fit: 'full',
    items: foodIds.map((fid) => ({ ...portionless, food_id: fid })),
    day_total: SNAP,
    targets_met: { calorie: true, protein: true, fat: true, carb: true },
    gaps: [],
  });

  it('returns a sorted food-id multiset', () => {
    expect(proposalSignature(make('p', ['f-b', 'f-a', 'f-a']))).toEqual(['f-a', 'f-a', 'f-b']);
  });

  it('appends new signatures and de-dups identical multisets', () => {
    const a = make('p1', ['f-a', 'f-b']);
    const b = make('p2', ['f-b', 'f-a']); // same multiset as a
    const c = make('p3', ['f-c']);
    const avoid = accumulateAvoid([], [a, b, c]);
    expect(avoid).toEqual([['f-a', 'f-b'], ['f-c']]);
    // re-accumulating the same proposals adds nothing
    expect(accumulateAvoid(avoid, [a, c])).toEqual(avoid);
  });
});

describe('buildConstraints', () => {
  const excluded: ExcludedFood[] = [{ food_id: 'f-beef', food_name: 'Bœuf' }];
  const pinned: PinnedLine[] = [stepPinned(pinnedFromItem(portioned), 1)]; // ×4 egg = 228 g

  it('returns undefined when nothing is constrained', () => {
    expect(buildConstraints([], [], [])).toBeUndefined();
  });

  it('includes only the non-empty fields', () => {
    expect(buildConstraints(excluded, [], [])).toEqual({ excluded_food_ids: ['f-beef'] });
    expect(buildConstraints([], pinned, [])).toEqual({
      pinned: [{ food_id: 'f-egg', meal_id: 'm1', portion_id: 'po-egg', grams: 228 }],
    });
  });

  it('assembles excluded + pinned + avoid together', () => {
    const avoid = [['f-a', 'f-b']];
    expect(buildConstraints(excluded, pinned, avoid)).toEqual({
      excluded_food_ids: ['f-beef'],
      pinned: [{ food_id: 'f-egg', meal_id: 'm1', portion_id: 'po-egg', grams: 228 }],
      avoid,
    });
  });
});
