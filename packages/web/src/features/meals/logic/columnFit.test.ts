import { describe, expect, it } from 'vitest';
import { columnFit, TARGET_COL_WIDTH } from './columnFit';

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
