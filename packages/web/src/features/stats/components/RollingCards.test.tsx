import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { RollingWindow } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { RollingCards } from './RollingCards';

// B-100: the rolling-card caption shows two SEPARATE, clearer lines — the position vs the
// window's target band, then the OK-day rate — instead of the misread "au-dessus 72% OK".
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const w = (over: Partial<RollingWindow> = {}): RollingWindow => ({
  window: 7,
  avg_kcal: 1800,
  ok_rate: 0.72,
  vs_target: 'above',
  ...over,
});

describe('RollingCards caption (B-100)', () => {
  it('renders the position and the OK rate as two distinct, clearer parts', () => {
    const { container } = render(<RollingCards windows={[w()]} />);
    const text = container.textContent ?? '';
    // The position word stands alone (its own coloured element), not glued to the rate.
    expect(screen.getByText('au-dessus')).toBeTruthy();
    // The OK rate now reads as a rate of days, not a bare "72% OK".
    expect(text).toContain('de jours OK');
    expect(text).toContain('72');
  });

  it('omits the position line when vs_target is null (keeps the OK rate)', () => {
    const { container } = render(<RollingCards windows={[w({ vs_target: null })]} />);
    expect(screen.queryByText('au-dessus')).toBeNull();
    expect(container.textContent ?? '').toContain('de jours OK');
  });
});
