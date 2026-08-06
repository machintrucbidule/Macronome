import { describe, expect, it } from 'vitest';
import { buildSlots, PAGE_SIZE, type Slot } from './usePagedList';

// LD-1/B-303 · D29 — what a not-yet-loaded area looks like. Grey placeholder rows appear ONLY where
// a page is actually coming (in flight, or next in the backfill queue); everywhere else the gap
// stays reserved empty height, exactly like the trailing reserve it replaces. That is what keeps a
// jump to the end of a 3 400-row catalog from materialising thousands of placeholder rows at once.
const rowsOf = (n: number, prefix: string): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i)}`);

const kinds = (slots: Slot<string>[]): string[] => slots.map((s) => s.kind);
const count = (slots: Slot<string>[], kind: Slot<string>['kind']): number =>
  slots.filter((s) => s.kind === kind).length;

describe('buildSlots — the shape of a partly-loaded list', () => {
  it('is empty until a total is known', () => {
    expect(buildSlots(new Map(), undefined, [0], undefined)).toEqual([]);
  });

  it('spans the whole result set, so the scrollbar is right from the first page', () => {
    const byIndex = new Map([[0, rowsOf(PAGE_SIZE, 'a')]]);
    const slots = buildSlots(byIndex, 500, [0], undefined);
    // 50 real rows + one gap standing in for the 450 that are not loaded.
    expect(count(slots, 'row')).toBe(PAGE_SIZE);
    expect(slots.at(-1)).toEqual({ kind: 'gap', rows: 450 });
  });

  it('merges consecutive unrequested pages into ONE gap element', () => {
    const byIndex = new Map([[0, rowsOf(PAGE_SIZE, 'a')]]);
    const slots = buildSlots(byIndex, 3400, [0], undefined);
    expect(count(slots, 'gap')).toBe(1);
    expect(count(slots, 'skeleton')).toBe(0);
  });

  it('shows placeholders for a page in flight, and a gap for the rest', () => {
    // Page 0 loaded, page 40 requested (the jump target) and still loading.
    const byIndex = new Map([[0, rowsOf(PAGE_SIZE, 'a')]]);
    const slots = buildSlots(byIndex, 3400, [0, 40], undefined);
    expect(count(slots, 'skeleton')).toBe(PAGE_SIZE); // exactly the one page in flight
    // Gaps either side of it: the pages nobody has asked for yet stay empty height (D29).
    expect(kinds(slots).filter((k, i, all) => k === 'gap' && all[i - 1] !== 'gap')).toHaveLength(2);
  });

  it('also shows placeholders for the page next in the backfill queue, and no further', () => {
    const byIndex = new Map([[0, rowsOf(PAGE_SIZE, 'a')]]);
    const withoutQueue = buildSlots(byIndex, 3400, [0, 40], undefined);
    const withQueue = buildSlots(byIndex, 3400, [0, 40], 39);
    expect(count(withQueue, 'skeleton')).toBe(count(withoutQueue, 'skeleton') + PAGE_SIZE);
  });

  it('sizes the last page by the total, not by the page size', () => {
    // 120 rows = pages 0,1 full and page 2 holding 20.
    const byIndex = new Map([[2, rowsOf(20, 'c')]]);
    const slots = buildSlots(byIndex, 120, [2], undefined);
    expect(count(slots, 'row')).toBe(20);
    expect(slots[0]).toEqual({ kind: 'gap', rows: 100 });
  });

  it('puts loaded pages in index order, whatever order they arrived in', () => {
    const byIndex = new Map([
      [2, rowsOf(2, 'c')],
      [0, rowsOf(2, 'a')],
    ]);
    // A tiny page size is not configurable, so use a total that keeps the maths readable: the
    // point is only that page 0's rows precede page 2's.
    const slots = buildSlots(byIndex, 2 * PAGE_SIZE + 2, [0, 2], undefined);
    const firstRow = slots.find((s) => s.kind === 'row');
    const lastRow = [...slots].reverse().find((s) => s.kind === 'row');
    expect(firstRow).toEqual({ kind: 'row', item: 'a0' });
    expect(lastRow).toEqual({ kind: 'row', item: 'c1' });
  });
});
