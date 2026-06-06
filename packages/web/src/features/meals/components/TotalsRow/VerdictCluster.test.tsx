import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { DayConstat } from '@macronome/shared';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { VerdictCluster } from './VerdictCluster';

// B-033/B-038: the activity select has no "Non définie" option (activity is always set), and the
// burn/deficit readout is always rendered — populated when a burn exists, a placeholder when the
// account has no weight yet. The literal "constat" caption is intentionally absent.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function renderCluster(activityLevel: string, constat: DayConstat) {
  const ctrl = {
    actions: { setActivity: vi.fn(), setVerdict: vi.fn() },
  } as unknown as MealsController;
  return render(
    <MealsProvider value={ctrl}>
      <VerdictCluster
        activityLevel={activityLevel}
        effective="NOK"
        auto="NOK"
        override={null}
        constat={constat}
      />
    </MealsProvider>,
  );
}

describe('VerdictCluster (B-033/B-038)', () => {
  it('has no "Non définie" activity option and selects the given level', () => {
    const { container } = renderCluster('sedentary', {
      estimated_burn: null,
      deficit: null,
      kg_per_week: null,
      per_level_activity_burn: null,
    });
    const select = container.querySelector('select') as HTMLSelectElement;
    expect([...select.options].some((o) => o.value === '')).toBe(false);
    expect(select.options.length).toBe(5);
    expect(select.value).toBe('sedentary');
  });

  it('renders the burn/deficit readout when a burn exists (no "constat" caption)', () => {
    const { container } = renderCluster('sedentary', {
      estimated_burn: 2076,
      deficit: -500,
      kg_per_week: -0.45,
      per_level_activity_burn: null,
    });
    const text = container.textContent ?? '';
    expect(text).toContain('2076');
    expect(text).toContain('déficit');
    expect(text).not.toContain('constat');
  });

  it('renders a placeholder instead of the readout when there is no weight', () => {
    const { container } = renderCluster('sedentary', {
      estimated_burn: null,
      deficit: null,
      kg_per_week: null,
      per_level_activity_burn: null,
    });
    expect(container.textContent ?? '').toContain(i18n.t('meals.constat.noWeight'));
  });
});
