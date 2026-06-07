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
