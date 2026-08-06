import { describe, expect, it } from 'vitest';
import type { Meal } from '@macronome/shared';
import { canClearMealLines, canZeroMealLines } from './mealBulk';

// B-296: the two ⋯ bulk entries are disabled when they would write nothing, so the menu never
// offers a no-op and the entries below never shift.
type Line = { served_quantity: number; is_pinned?: boolean };

const meal = (entries: Line[], groups = 0): Meal =>
  ({
    entries: entries.map((e, i) => ({ id: `e${i}`, is_pinned: false, ...e })),
    leftover_groups: Array.from({ length: groups }, (_, i) => ({ id: `g${i}` })),
  }) as unknown as Meal;

describe('canClearMealLines — Supprimer tous les aliments', () => {
  it('is false on an empty meal', () => {
    expect(canClearMealLines(meal([]))).toBe(false);
  });

  it('is false when every line is a garde-manger line already at 0 (a delete keeps them, D1)', () => {
    expect(canClearMealLines(meal([{ served_quantity: 0, is_pinned: true }]))).toBe(false);
  });

  it('is true for a normal line, even at quantity 0 — it would be deleted', () => {
    expect(canClearMealLines(meal([{ served_quantity: 0 }]))).toBe(true);
  });

  it('is true for a garde-manger line carrying a quantity — it would be reset to 0', () => {
    expect(canClearMealLines(meal([{ served_quantity: 120, is_pinned: true }]))).toBe(true);
  });

  it('is true when only a leftover group remains to dissolve', () => {
    expect(canClearMealLines(meal([], 1))).toBe(true);
  });
});

describe('canZeroMealLines — Tout remettre à zéro', () => {
  it('is false when every quantity is already 0, pinned or not', () => {
    expect(
      canZeroMealLines(meal([{ served_quantity: 0 }, { served_quantity: 0, is_pinned: true }])),
    ).toBe(false);
  });

  it('is true as soon as one line carries a quantity', () => {
    expect(canZeroMealLines(meal([{ served_quantity: 0 }, { served_quantity: 80 }]))).toBe(true);
  });

  it('is true when a leftover group would go with the reset', () => {
    expect(canZeroMealLines(meal([{ served_quantity: 0 }], 1))).toBe(true);
  });
});
