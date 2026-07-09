import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DayDetail, Meal, MealEntry } from '@macronome/shared';
import { useMealSelection } from './useMealSelection';

// B-207: the selection hook holds the Σ mode + a cross-meal Set and derives the sum. Neutral data.

function line(id: string, kcal: number): MealEntry {
  return {
    id,
    kind: 'referenced',
    food_id: `f-${id}`,
    custom_name: null,
    served_quantity: 100,
    unit: 'g',
    portion_id: null,
    served_grams: 100,
    snap: { kcal, fat: 1, carb: 2, protein: 3 },
    consumed: { grams: 100, quantity: 100, kcal, fat: 1, carb: 2, protein: 3 },
    is_pinned: false,
    order_index: 0,
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

const day = {
  meals: [meal('A', [line('e1', 200), line('e2', 120)]), meal('B', [line('e3', 300)])],
} as unknown as DayDetail;

describe('useMealSelection', () => {
  it('toggles a line and derives the sum', () => {
    const { result } = renderHook(() => useMealSelection(day));
    act(() => result.current.toggle('e1'));
    expect(result.current.isSelected('e1')).toBe(true);
    expect(result.current.sum.kcal).toBe(200);
    expect(result.current.sum.grams).toBe(100);
    act(() => result.current.toggle('e1'));
    expect(result.current.isSelected('e1')).toBe(false);
    expect(result.current.sum.kcal).toBe(0);
  });

  it('toggleMeal adds all then removes all (all-in ↔ none)', () => {
    const { result } = renderHook(() => useMealSelection(day));
    act(() => result.current.toggleMeal(['e1', 'e2']));
    expect(result.current.allSelected(['e1', 'e2'])).toBe(true);
    expect(result.current.sum.kcal).toBe(320);
    act(() => result.current.toggleMeal(['e1', 'e2']));
    expect(result.current.allSelected(['e1', 'e2'])).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });

  it('does not double-count a meal plus one of its own lines', () => {
    const { result } = renderHook(() => useMealSelection(day));
    act(() => result.current.toggle('e1'));
    act(() => result.current.toggleMeal(['e1', 'e2'])); // e1 already in → adds e2 (not all-in)
    expect(result.current.sum.kcal).toBe(320); // 200 + 120, e1 counted once
  });

  it('Ctrl/⌘-click (additive) enters selection mode, then toggles', () => {
    const { result } = renderHook(() => useMealSelection(day));
    expect(result.current.mode).toBe(false);
    act(() => result.current.selectFromRow('e3', true));
    expect(result.current.mode).toBe(true);
    expect(result.current.isSelected('e3')).toBe(true);
  });

  it('exit() leaves the mode and clears the selection', () => {
    const { result } = renderHook(() => useMealSelection(day));
    act(() => result.current.enter());
    act(() => result.current.toggle('e1'));
    act(() => result.current.exit());
    expect(result.current.mode).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });
});
