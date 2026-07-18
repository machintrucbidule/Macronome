import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { HeatmapCell } from '@macronome/shared';
import i18n from '../../i18n/config';
import { Heatmap, cellTip } from './Heatmap';
import styles from './Heatmap.module.css';

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
  comment: null,
  ...over,
});

describe('Heatmap', () => {
  it('rounds the kcal value in the styled cell tooltip to an integer (B-057)', () => {
    const tip = cellTip(cell({ kcal: 1600.4 }), (k) => k, 'fr');
    expect(tip.rows).toContain('1600 kcal');
    expect(tip.rows.join(' ')).not.toContain('1600.4');
  });

  it('omits the kcal line on a non-logged cell, keeping the status line', () => {
    const tip = cellTip(cell({ kcal: null, status: 'none' }), (k) => k, 'fr');
    expect(tip.rows).toEqual(['stats.status.none']);
  });

  it('appends the day comment as a final line when present (B-226)', () => {
    const tip = cellTip(cell({ comment: 'trop de sel' }), (k) => k, 'fr');
    expect(tip.rows).toEqual(['1600 kcal', 'stats.status.OK', 'trop de sel']);
  });

  it('shows the comment on a grey not-logged cell too (B-226)', () => {
    const tip = cellTip(cell({ kcal: null, status: 'none', comment: 'malade' }), (k) => k, 'fr');
    expect(tip.rows).toEqual(['stats.status.none', 'malade']);
  });

  it('adds no comment line when the cell has none', () => {
    const tip = cellTip(cell({ comment: null }), (k) => k, 'fr');
    expect(tip.rows).toEqual(['1600 kcal', 'stats.status.OK']);
  });

  it('colours a NOK_under cell orange (.warn) and a NOK_over cell red (.nok) (B-167)', () => {
    const under = render(<Heatmap cells={[cell({ status: 'NOK_under' })]} />);
    expect(under.container.querySelector('rect')!.getAttribute('class')).toBe(styles.warn);
    cleanup();
    const over = render(<Heatmap cells={[cell({ status: 'NOK_over' })]} />);
    expect(over.container.querySelector('rect')!.getAttribute('class')).toBe(styles.nok);
    cleanup();
    const ok = render(<Heatmap cells={[cell({ status: 'OK' })]} />);
    expect(ok.container.querySelector('rect')!.getAttribute('class')).toBe(styles.ok);
  });

  it('renders weekday row labels every other row (B-073)', () => {
    const { container } = render(<Heatmap cells={[cell({})]} />);
    // Weekday labels are the only end-anchored texts (rows Mon/Wed/Fri/Sun).
    const dows = container.querySelectorAll('text[text-anchor="end"]');
    expect(dows).toHaveLength(4);
  });
});
