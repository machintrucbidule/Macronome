import { describe, expect, it } from 'vitest';
import { columnFit, hasOverflow, TARGET_COL_WIDTH } from './columnFit';

// View-only geometry oracle: n = round(width / 400), colWidth = floor(width / n).
describe('columnFit', () => {
  it('fits a single column on a narrow viewport', () => {
    expect(columnFit(360)).toEqual({ columns: 1, colWidth: 360 });
  });

  it('rounds to the nearest integer column count', () => {
    // 1200 / 400 = 3 → floor(1200/3) = 400
    expect(columnFit(1200)).toEqual({ columns: 3, colWidth: 400 });
    // 1000 / 400 = 2.5 → round = 3 → floor(1000/3) = 333
    expect(columnFit(1000)).toEqual({ columns: 3, colWidth: 333 });
    // 900 / 400 = 2.25 → round = 2 → floor(900/2) = 450
    expect(columnFit(900)).toEqual({ columns: 2, colWidth: 450 });
  });

  it('never returns fewer than one column', () => {
    expect(columnFit(0).columns).toBe(1);
    expect(columnFit(-50).columns).toBe(1);
  });

  it('uses the canonical 400px target width by default', () => {
    expect(TARGET_COL_WIDTH).toBe(400);
    expect(columnFit(800).columns).toBe(2);
  });
});

// B-075: overflow ⇔ more meals than fitting columns. These cases stay correct even when the
// `floor` leaves a sub-pixel residual (width=1000), where the old DOM scrollWidth check flagged
// a phantom scrollbar.
describe('hasOverflow', () => {
  it('reports no overflow when meals fit the integer-fit columns', () => {
    expect(hasOverflow(1200, 3)).toBe(false); // 3 columns, 3 meals
    expect(hasOverflow(1000, 3)).toBe(false); // 3 columns (floor residual), 3 meals — no phantom
    expect(hasOverflow(360, 1)).toBe(false); // 1 column, 1 meal
  });

  it('reports overflow when meals exceed the fitting columns', () => {
    expect(hasOverflow(1200, 4)).toBe(true); // 3 columns, 4 meals
    expect(hasOverflow(1000, 4)).toBe(true);
    expect(hasOverflow(360, 2)).toBe(true); // 1 column, 2 meals
  });
});

// B-244: a user minimum raises the count while each column still gets MIN_VIABLE_COL_WIDTH.
// Widths below are the scroller's usable width = viewport − 36px of page gutter.
describe('columnFit with a minimum column count (B-244)', () => {
  it('honours the minimum on the owner’s 1280px window (1244px usable)', () => {
    expect(columnFit(1244, 1)).toEqual({ columns: 3, colWidth: 414 }); // today's automatic fit
    expect(columnFit(1244, 4)).toEqual({ columns: 4, colWidth: 311 }); // 4 meals now fit
  });

  it('raises a ~1000px window from 2 to 3 columns (964px usable)', () => {
    expect(columnFit(964, 1)).toEqual({ columns: 2, colWidth: 482 });
    expect(columnFit(964, 4)).toEqual({ columns: 3, colWidth: 321 }); // floor(964/300) = 3 caps it
  });

  it('lets the 300px viability floor win over the setting (764px usable)', () => {
    // floor(764/300) = 2, so a minimum of 4 cannot apply: the automatic count stands.
    expect(columnFit(764, 4)).toEqual(columnFit(764, 1));
    expect(columnFit(764, 4).columns).toBe(2);
    // A phone-width scroller can never be pushed past one column.
    expect(columnFit(360, 6).columns).toBe(1);
  });

  it('never reduces the automatically computed count', () => {
    // 1884px (1080p maximised) rounds to 5 columns; a minimum of 4 must not pull it down.
    expect(columnFit(1884, 4).columns).toBe(5);
    expect(columnFit(1244, 1).columns).toBe(columnFit(1244, 0).columns);
  });

  it('keeps the overflow chrome consistent with the raised count', () => {
    expect(hasOverflow(1244, 4)).toBe(true); // 3 columns without the setting
    expect(hasOverflow(1244, 4, 4)).toBe(false); // 4 columns with it → no arrows, no scrollbar
    expect(hasOverflow(1244, 5, 4)).toBe(true); // a 5th meal still overflows
  });
});
