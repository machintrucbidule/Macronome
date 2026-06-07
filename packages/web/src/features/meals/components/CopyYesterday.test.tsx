import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { MealsControls } from './MealsControls';
import { CopyYesterdayConfirm } from './CopyYesterdayConfirm';

// CP-1 / B-082: "Copier hier" sits in the controls row and replaces the day with a copy of
// yesterday behind a strong confirm. These cover the button wiring + the confirm modal.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

describe('Copier hier (B-082)', () => {
  it('renders the button and fires onCopyYesterday on click', () => {
    const onCopyYesterday = vi.fn();
    render(
      <MealsControls onClear={vi.fn()} onCopyYesterday={onCopyYesterday} onAddMeal={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.copyYesterday') }));
    expect(onCopyYesterday).toHaveBeenCalledTimes(1);
  });

  it('confirm modal confirms and cancels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<CopyYesterdayConfirm onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(i18n.t('meals.copy.prompt'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.copy.confirm') }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(<CopyYesterdayConfirm onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
