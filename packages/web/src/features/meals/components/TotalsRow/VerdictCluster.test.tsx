import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
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
    actions: { setActivity: vi.fn() },
  } as unknown as MealsController;
  return render(
    <MealsProvider value={ctrl}>
      <VerdictCluster activityLevel={activityLevel} constat={constat} />
    </MealsProvider>,
  );
}

describe('VerdictCluster (B-033/B-038, B-085)', () => {
  it('renders the 5 activity levels in a verdict-style menu and reflects the current level', () => {
    const { container } = renderCluster('sedentary', {
      estimated_burn: null,
      deficit: null,
      kg_per_week: null,
      per_level_activity_burn: null,
    });
    // B-085: the native <select> is gone — it is now a clickable badge + dropdown menu.
    expect(container.querySelector('select')).toBeNull();
    const trigger = container.querySelector('[aria-haspopup="listbox"]') as HTMLElement;
    expect(trigger.textContent).toContain(i18n.t('activity.sedentary.label'));
    fireEvent.click(trigger);
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(5);
    expect([...options].filter((o) => o.getAttribute('aria-selected') === 'true').length).toBe(1);
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
