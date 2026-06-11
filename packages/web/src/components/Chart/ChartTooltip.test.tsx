import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ChartBox } from './scale';
import { ChartTooltip } from './ChartTooltip';

// CT-1/B-140: the styled tooltip renders a title line + one value per row, from a structured
// TipContent. Pure presentation — this guards the multi-line shape (title first, then rows).
const BOX: ChartBox = { w: 100, h: 100, padL: 0, padR: 0, padT: 0, padB: 0 };

afterEach(() => cleanup());

describe('ChartTooltip', () => {
  it('renders the title first, then one node per value row', () => {
    const { getByRole } = render(
      <ChartTooltip
        point={{ cx: 50, cy: 50, tip: { title: 'June', rows: ['15 OK', '5 NOK'] } }}
        box={BOX}
      />,
    );

    const card = getByRole('status');
    const children = [...card.children];
    expect(children).toHaveLength(3); // title + 2 rows
    expect(children[0]?.textContent).toBe('June');
    expect(children.slice(1).map((c) => c.textContent)).toEqual(['15 OK', '5 NOK']);
  });

  it('renders a single-row tip (weight point)', () => {
    const { getByRole } = render(
      <ChartTooltip
        point={{ cx: 50, cy: 50, tip: { title: '2026-06-10', rows: ['78.5 kg'] } }}
        box={BOX}
      />,
    );
    const card = getByRole('status');
    const children = [...card.children];
    expect(children).toHaveLength(2);
    expect(children[0]?.textContent).toBe('2026-06-10');
    expect(children[1]?.textContent).toBe('78.5 kg');
  });
});
