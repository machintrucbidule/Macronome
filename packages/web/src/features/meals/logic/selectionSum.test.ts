import { describe, expect, it } from 'vitest';
import type { Meal, MealEntry } from '@macronome/shared';
import { eligibleIds, isSelectableEntry, selectionSum } from './selectionSum';

// B-207: the Σ readout is a pure client-side addition of each selected line's server-computed
// `consumed` values. Neutral oracle (no personal data): known consumed values across two meals.

interface Consumed {
  grams: number | null;
  kcal: number;
  fat: number;
  carb: number;
  protein: number;
}

function entry(id: string, consumed: Consumed, over: Partial<MealEntry> = {}): MealEntry {
  return {
    id,
    kind: 'referenced',
    food_id: `food-${id}`,
    custom_name: null,
    served_quantity: 100,
    unit: 'g',
    portion_id: null,
    served_grams: consumed.grams,
    snap: {
      kcal: consumed.kcal,
      fat: consumed.fat,
      carb: consumed.carb,
      protein: consumed.protein,
    },
    consumed: { quantity: consumed.grams, ...consumed },
    is_pinned: false,
    order_index: 0,
    ...over,
  };
}

function meal(id: string, entries: MealEntry[]): Meal {
  return {
    id,
    slot_name: id,
    order_index: 0,
    entries,
    leftover_groups: [],
    totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
  };
}

// e1 + e2 = meal A; e3 = meal B; scaffold = greyed qty-0 garde-manger line (not selectable).
const e1 = entry('e1', { grams: 100, kcal: 200, fat: 10, carb: 20, protein: 15 });
const e2 = entry('e2', { grams: 50, kcal: 120, fat: 5, carb: 12, protein: 8 });
const e3 = entry('e3', { grams: 200, kcal: 300, fat: 12, carb: 40, protein: 25 });
const scaffold = entry(
  'e4',
  { grams: 0, kcal: 0, fat: 0, carb: 0, protein: 0 },
  { served_quantity: 0, is_pinned: true },
);
const mealA = meal('A', [e1, e2]);
const mealB = meal('B', [e3, scaffold]);
const meals = [mealA, mealB];

describe('selectionSum', () => {
  it('sums the consumed values across meals (empty selection = zero)', () => {
    expect(selectionSum(meals, new Set())).toEqual({
      grams: 0,
      kcal: 0,
      fat: 0,
      carb: 0,
      protein: 0,
    });
  });

  it('sums lines picked across two meals', () => {
    // e1 (100/200/10/20/15) + e3 (200/300/12/40/25)
    expect(selectionSum(meals, new Set(['e1', 'e3']))).toEqual({
      grams: 300,
      kcal: 500,
      fat: 22,
      carb: 60,
      protein: 40,
    });
  });

  it('a whole meal = the sum of its lines', () => {
    // meal A = e1 + e2
    expect(selectionSum(meals, new Set(['e1', 'e2']))).toEqual({
      grams: 150,
      kcal: 320,
      fat: 15,
      carb: 32,
      protein: 23,
    });
  });

  it('does not double-count when a meal and one of its own lines are both selected', () => {
    // The Set already holds e1 and e2 once each → identical to the whole-meal sum above.
    const set = new Set(['e1', 'e2']);
    set.add('e1'); // "select meal total" re-adds its lines — Set dedups.
    expect(selectionSum(meals, set)).toEqual({
      grams: 150,
      kcal: 320,
      fat: 15,
      carb: 32,
      protein: 23,
    });
  });

  it('excludes the greyed qty-0 garde-manger scaffold from eligibility', () => {
    expect(isSelectableEntry(scaffold)).toBe(false);
    expect(isSelectableEntry(e1)).toBe(true);
    expect(eligibleIds(mealB)).toEqual(['e3']);
    expect(eligibleIds(mealA)).toEqual(['e1', 'e2']);
  });
});
