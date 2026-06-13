import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { MonthlyStat } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { MonthlyBars } from './MonthlyBars';
import styles from '../stats.module.css';

// B-167: the monthly OK/NOK bars are a 3-segment stack — OK green, NOK-déficit orange (.barWarn),
// NOK-surplus/unknown red — and the legend gains the orange swatch. The component only draws the
// server counts (ok_count / nok_under_count / nok_over_count).
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const month = (over: Partial<MonthlyStat>): MonthlyStat => ({
  month: 5,
  ok_count: 3,
  nok_count: 2,
  nok_under_count: 1,
  nok_over_count: 1,
  ok_rate: 0.6,
  avg_kcal_ok: 1600,
  avg_kcal_nok: 1800,
  avg_kcal_global: 1680,
  target_zone: null,
  ...over,
});

describe('MonthlyBars 3-segment stack (B-167)', () => {
  it('draws an orange NOK-déficit segment alongside the green OK and red NOK-surplus ones', () => {
    const { container } = render(<MonthlyBars monthly={[month({})]} year={2026} />);
    expect(container.querySelectorAll(`.${styles.barOk}`)).toHaveLength(1);
    expect(container.querySelectorAll(`.${styles.barWarn}`)).toHaveLength(1);
    expect(container.querySelectorAll(`.${styles.barNok}`)).toHaveLength(1);
  });

  it('shows the orange NOK-déficit swatch in the legend', () => {
    const { container } = render(<MonthlyBars monthly={[month({})]} year={2026} />);
    expect(container.textContent).toContain(i18n.t('stats.legend.nokUnder'));
    expect(container.textContent).toContain(i18n.t('stats.legend.nokOver'));
  });
});
