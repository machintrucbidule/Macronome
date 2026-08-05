import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ChartTooltip } from './ChartTooltip';

// CT-1/B-140: the styled tooltip renders a centered title line + one value per row, from a
// structured TipContent, and is portaled to <body> (queried via `screen`, not the container).
// B-272: it carries NO role="status" — a hover-driven tooltip announced as a status fires on
// every pointer move — so these cases query it by test id instead.
afterEach(() => cleanup());

describe('ChartTooltip', () => {
  it('renders the title first, then one node per value row', () => {
    render(
      <ChartTooltip
        anchor={{
          x: 50,
          y: 50,
          tip: { title: 'Février 2026', rows: ['21 jours OK', '10 jours NOK'] },
        }}
      />,
    );

    const card = screen.getByTestId('chart-tooltip');
    const children = [...card.children];
    expect(children).toHaveLength(3); // title + 2 rows
    expect(children[0]?.textContent).toBe('Février 2026');
    expect(children.slice(1).map((c) => c.textContent)).toEqual(['21 jours OK', '10 jours NOK']);
  });

  it('renders a single-row tip (weight point)', () => {
    render(
      <ChartTooltip anchor={{ x: 50, y: 50, tip: { title: '10 juin 2026', rows: ['78.5 kg'] } }} />,
    );
    const card = screen.getByTestId('chart-tooltip');
    const children = [...card.children];
    expect(children).toHaveLength(2);
    expect(children[0]?.textContent).toBe('10 juin 2026');
    expect(children[1]?.textContent).toBe('78.5 kg');
  });
});
