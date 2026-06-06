import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { HeatmapCell } from '@macronome/shared';
import i18n from '../../i18n/config';
import { Heatmap } from './Heatmap';

// The heatmap places + colours server-computed cells. It derives nothing; it only rounds
// the kcal readout for display (00-conventions.md) and labels the weekday rows (charts.md).
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const cell = (over: Partial<HeatmapCell>): HeatmapCell => ({
  date: '2026-01-05',
  status: 'OK',
  kcal: 1600,
  ...over,
});

describe('Heatmap', () => {
  it('rounds the kcal value in the cell tooltip to an integer (B-057)', () => {
    const { container } = render(<Heatmap cells={[cell({ kcal: 1600.4 })]} />);
    const title = container.querySelector('title')?.textContent ?? '';
    expect(title).toContain('1600 kcal');
    expect(title).not.toContain('1600.4');
  });

  it('renders weekday row labels every other row (B-073)', () => {
    const { container } = render(<Heatmap cells={[cell({})]} />);
    // Weekday labels are the only end-anchored texts (rows Mon/Wed/Fri/Sun).
    const dows = container.querySelectorAll('text[text-anchor="end"]');
    expect(dows).toHaveLength(4);
  });
});
