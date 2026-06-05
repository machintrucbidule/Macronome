import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { PinCell } from './PinCell';

// B-025: the garde-manger pin is interactive (it was an inert "(à venir)" span). A persisted
// referenced line toggles pin/unpin; a custom line shows nothing; a preview/scaffold pantry
// line (id '') shows the filled pin but is not yet a toggle (no DB row to pin).
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function renderPin(props: Parameters<typeof PinCell>[0], togglePin = vi.fn()) {
  const ctrl = { actions: { togglePin } } as unknown as MealsController;
  const utils = render(
    <MealsProvider value={ctrl}>
      <PinCell {...props} />
    </MealsProvider>,
  );
  return { ...utils, togglePin };
}

describe('PinCell (B-025)', () => {
  it('toggles a persisted referenced line on click', () => {
    const { getByRole, togglePin } = renderPin({
      mealId: 'm1',
      entryId: 'e1',
      isPinned: false,
      show: true,
    });
    const btn = getByRole('button');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn);
    expect(togglePin).toHaveBeenCalledWith('m1', 'e1', false);
  });

  it('renders nothing for a custom line (show=false)', () => {
    const { container } = renderPin({ mealId: 'm1', entryId: 'e1', isPinned: false, show: false });
    expect(container.textContent).toBe('');
    expect(container.querySelector('button')).toBeNull();
  });

  it('shows the pin but no toggle for a preview pantry line (id "")', () => {
    const { container } = renderPin({ mealId: '', entryId: '', isPinned: true, show: true });
    expect(container.textContent).toContain('📌');
    expect(container.querySelector('button')).toBeNull();
  });
});
