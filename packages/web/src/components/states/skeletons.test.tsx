import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { SkeletonMealDay } from './SkeletonMealDay';
import { SkeletonTableRows } from './SkeletonTableRows';

// B-264: design/components/states.md §Loading states contracts distinct skeleton shapes — a
// totals row + meal columns for Repas, rows *at row height* for tables. A single 14px bar stood
// in for all of them, so the layout jumped when the data landed. These assert the shapes.
afterEach(cleanup);

const all = (el: HTMLElement, id: string): NodeListOf<Element> =>
  el.querySelectorAll(`[data-testid="${id}"]`);

describe('SkeletonTableRows', () => {
  it('draws a header band plus the requested rows', () => {
    const { container } = render(<SkeletonTableRows rows={5} />);
    expect(all(container, 'skeleton-table')).toHaveLength(1);
    expect(all(container, 'skeleton-table-row')).toHaveLength(5);
  });

  it('sizes each row at the table row height so the layout does not jump', () => {
    const { container } = render(<SkeletonTableRows rows={3} rowHeight={38} />);
    for (const row of all(container, 'skeleton-table-row')) {
      expect((row as HTMLElement).style.height).toBe('38px');
    }
  });

  it('is hidden from assistive technology', () => {
    const { container } = render(<SkeletonTableRows />);
    const root = container.querySelector('[data-testid="skeleton-table"]');
    expect(root?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('SkeletonMealDay', () => {
  it('draws the totals row and one column per meal, each with its lines', () => {
    const { container } = render(<SkeletonMealDay columns={4} lines={20} />);
    expect(all(container, 'skeleton-totals')).toHaveLength(1);
    expect(all(container, 'skeleton-meal-column')).toHaveLength(4);
    expect(all(container, 'skeleton-meal-line')).toHaveLength(4 * 20);
  });

  it('collapses to a single column on a phone, where one meal shows at a time', () => {
    const { container } = render(<SkeletonMealDay columns={1} lines={15} />);
    expect(all(container, 'skeleton-meal-column')).toHaveLength(1);
    expect(all(container, 'skeleton-meal-line')).toHaveLength(15);
  });
});
