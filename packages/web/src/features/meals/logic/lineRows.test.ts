import { describe, expect, it } from 'vitest';
import type { MealEntry } from '@macronome/shared';
import {
  DEFAULT_LINES_DESKTOP,
  DEFAULT_LINES_MOBILE,
  buildLineRows,
  firstFreeSlot,
} from './lineRows';

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

  // B-203: the floor is a user setting; these are the fallback defaults (desktop 20 / mobile 15,
  // superseding the fixed B-186 18/15). The trailing-empties rule is unchanged, so a tall meal
  // still grows past either floor as the case above shows.
  it('applies the desktop default floor of 20 empty rows', () => {
    expect(DEFAULT_LINES_DESKTOP).toBe(20);
    expect(buildLineRows([], DEFAULT_LINES_DESKTOP)).toHaveLength(20);
  });

  it('keeps the mobile default floor at 15 empty rows', () => {
    expect(DEFAULT_LINES_MOBILE).toBe(15);
    expect(buildLineRows([], DEFAULT_LINES_MOBILE)).toHaveLength(15);
  });

  // B-203: buildLineRows honours whatever configurable floor it is given, and a fuller day still
  // wins over the floor (the trailing-empties rule is independent of it).
  it('honours an arbitrary configured floor, and a fuller day overrides it', () => {
    expect(buildLineRows([], 30)).toHaveLength(30); // custom floor honoured
    expect(buildLineRows([], 6)).toHaveLength(6); // a small floor is honoured too
    // A meal with an entry at row 40 needs 43 rows regardless of a smaller floor.
    expect(buildLineRows([entry('z', 40)], 20)).toHaveLength(43);
  });
});

describe('firstFreeSlot (QP-1/B-158)', () => {
  it('returns 0 when the meal has no entries', () => {
    expect(firstFreeSlot([])).toBe(0);
  });

  it('returns the first internal gap', () => {
    // rows 0,1,3 taken → first free is 2
    expect(firstFreeSlot([entry('a', 0), entry('b', 1), entry('c', 3)])).toBe(2);
  });

  it('skips placeholders occupying rows 0..n and returns the first gap after them', () => {
    // garde-manger placeholders at 0,1,2 occupy their order_index → first free is 3
    expect(firstFreeSlot([entry('p0', 0), entry('p1', 1), entry('p2', 2)])).toBe(3);
  });

  it('appends after the last line when every row up to the max is taken', () => {
    expect(firstFreeSlot([entry('a', 0), entry('b', 1), entry('c', 2)])).toBe(3);
  });

  it('fills a leading gap before later rows', () => {
    // rows 2,3 taken, 0 and 1 free → first free is 0
    expect(firstFreeSlot([entry('a', 2), entry('b', 3)])).toBe(0);
  });
});
