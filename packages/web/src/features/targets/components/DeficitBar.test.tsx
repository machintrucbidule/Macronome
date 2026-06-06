import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { EngineReadout } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { DeficitBar } from './DeficitBar';

// The deficit bar reconstructs the target midpoint from server outputs (burn + deficit at
// target) and picks the deficit / surplus / balance synthesis. It computes no nutrition
// figure: burn, deficit and kg/week all come from the engine readout.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const engine = (over: Partial<EngineReadout>): EngineReadout => ({
  age: 44,
  bmr: 1600,
  current_weight_kg: 75,
  recent_avg_activity: 1.3,
  estimated_burn: 2000,
  empirical_burn: 2050,
  protein_floor_g: 140,
  fat_floor_g: 52,
  carb_ceiling_g: 120,
  deficit_at_target: -300,
  kg_per_week: -0.27,
  target_bmi: 23,
  ...over,
});

describe('DeficitBar', () => {
  it('shows a deficit synthesis with the reconstructed midpoint (burn + deficit)', () => {
    const { container } = render(
      <DeficitBar engine={engine({ estimated_burn: 2000, deficit_at_target: -300 })} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('1700'); // midpoint = 2000 + (−300)
    expect(text).toContain('2000'); // estimated burn
    expect(text).toContain('300'); // deficit magnitude
    expect(text).toContain('déficit');
  });

  it('shows a surplus synthesis when the deficit at target is positive', () => {
    const { container } = render(
      <DeficitBar engine={engine({ estimated_burn: 2000, deficit_at_target: 200 })} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('2200'); // midpoint = 2000 + 200
    expect(text).toContain('surplus');
  });

  it('shows a balance synthesis when target and burn match', () => {
    const { container } = render(
      <DeficitBar engine={engine({ estimated_burn: 2000, deficit_at_target: 0 })} />,
    );
    expect(container.textContent ?? '').toContain('équilibre');
  });

  it('renders nothing without an estimated burn or a deficit', () => {
    const { container } = render(<DeficitBar engine={engine({ estimated_burn: null })} />);
    expect(container.firstChild).toBeNull();
  });
});
