import { describe, expect, it } from 'vitest';
import type { MealEntry } from '@macronome/shared';
import { computeOrder } from './useTouchReorder';

// Pure reorder contract (the long-press gesture itself is verified by inspection on a touch device,
// per the mobile-responsive plan — no layout unit tests).
const entry = (id: string): MealEntry => ({ id }) as MealEntry;

describe('computeOrder', () => {
  it('returns null for a no-op drop on the same row', () => {
    expect(computeOrder('a', 2, 2, new Map())).toBeNull();
  });

  it('moves into an empty row without touching others', () => {
    const byRow = new Map<number, MealEntry>([[0, entry('a')]]);
    expect(computeOrder('a', 0, 3, byRow)).toEqual([{ id: 'a', order_index: 3 }]);
  });

  it('swaps with the occupant of the target row', () => {
    const byRow = new Map<number, MealEntry>([
      [0, entry('a')],
      [1, entry('b')],
    ]);
    expect(computeOrder('a', 0, 1, byRow)).toEqual([
      { id: 'a', order_index: 1 },
      { id: 'b', order_index: 0 },
    ]);
  });
});
