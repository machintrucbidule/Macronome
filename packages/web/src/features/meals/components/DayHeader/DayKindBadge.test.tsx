import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { DayKindBadge } from './DayKindBadge';

// DK-1 / B-078: the day-kind chip opens a menu switching Complet <-> Partiel. Switching to
// Partiel on a day with food (confirmNeeded) goes through a strong confirm first.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function renderBadge(kind: 'detailed' | 'summary', confirmNeeded: boolean) {
  const actions = { convertToDetailed: vi.fn(), convertToSummary: vi.fn() };
  const ctrl = { actions } as unknown as MealsController;
  const utils = render(
    <MealsProvider value={ctrl}>
      <DayKindBadge kind={kind} confirmNeeded={confirmNeeded} />
    </MealsProvider>,
  );
  return { ...utils, actions };
}

describe('DayKindBadge (DK-1 / B-078)', () => {
  it('colour-codes the chip green on Complet, yellow on Partiel', () => {
    const { container, rerender } = renderBadge('detailed', false);
    const chip = container.querySelector('button') as HTMLButtonElement;
    expect(chip.className).toMatch(/complet/);

    const actions = { convertToDetailed: vi.fn(), convertToSummary: vi.fn() };
    rerender(
      <MealsProvider value={{ actions } as unknown as MealsController}>
        <DayKindBadge kind="summary" confirmNeeded={false} />
      </MealsProvider>,
    );
    expect((container.querySelector('button') as HTMLButtonElement).className).toMatch(/partiel/);
  });

  it('switching to Complet calls convertToDetailed (no confirm)', () => {
    const { container, actions } = renderBadge('summary', false);
    fireEvent.click(container.querySelector('button') as HTMLButtonElement); // open menu
    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.dayType.detailed') }));
    expect(actions.convertToDetailed).toHaveBeenCalledTimes(1);
    expect(actions.convertToSummary).not.toHaveBeenCalled();
  });

  it('switching to Partiel with no food converts directly (no confirm modal)', () => {
    const { container, actions } = renderBadge('detailed', false);
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.dayType.summary') }));
    expect(actions.convertToSummary).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(i18n.t('meals.convertSummary.prompt'))).toBeNull();
  });

  it('switching to Partiel with food opens the confirm, then converts on confirm', () => {
    const { container, actions } = renderBadge('detailed', true);
    fireEvent.click(container.querySelector('button') as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.dayType.summary') }));
    // Confirm modal shown; conversion not yet fired.
    expect(screen.getByText(i18n.t('meals.convertSummary.prompt'))).toBeTruthy();
    expect(actions.convertToSummary).not.toHaveBeenCalled();
    // Confirm → converts.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.convertSummary.confirm') }));
    expect(actions.convertToSummary).toHaveBeenCalledTimes(1);
  });
});
