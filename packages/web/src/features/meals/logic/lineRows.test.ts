import { describe, expect, it } from 'vitest';
import type { MealEntry } from '@macronome/shared';
import { buildLineRows } from './lineRows';

// Positional rows (B-028): entries land at their order_index; blank rows in between are
// kept; there are always ≥2 trailing empties and ≥ minLines total.
const entry = (id: string, order_index: number): MealEntry =>
  ({ id, order_index }) as unknown as MealEntry;

describe('buildLineRows (B-028)', () => {
  it('pads to minLines and fills all rows when there are no entries', () => {
    const rows = buildLineRows([], 15);
    expect(rows).toHaveLength(15);
    expect(rows.every((r) => r.entry === null)).toBe(true);
  });

  it('places each entry at its order_index, keeping blank rows above', () => {
    const e = entry('a', 4);
    const rows = buildLineRows([e], 15);
    expect(rows[4]?.entry).toBe(e);
    expect(rows[0]?.entry).toBeNull(); // the chosen gap is preserved
    expect(rows).toHaveLength(15);
  });

  it('grows past minLines to keep ≥2 trailing empty rows after the last entry', () => {
    const e = entry('z', 20);
    const rows = buildLineRows([e], 15);
    expect(rows).toHaveLength(23); // 20 + 1 + 2 trailing
    expect(rows[20]?.entry).toBe(e);
    expect(rows[21]?.entry).toBeNull();
    expect(rows[22]?.entry).toBeNull();
  });
});
