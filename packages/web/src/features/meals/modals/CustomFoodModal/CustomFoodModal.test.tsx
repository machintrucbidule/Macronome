import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { CustomTarget, MealsController } from '../../hooks/useMealsController';
import { CustomFoodModal } from './CustomFoodModal';

// B-087: pressing Enter saves the custom food when the form is valid (a positive kcal), and is
// a no-op otherwise. The modal is a <div> (not a <form>), so the key is handled on the body.
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

function renderModal() {
  const saveCustom = vi.fn();
  const ctrl = {
    actions: { saveCustom, closeCustom: vi.fn() },
  } as unknown as MealsController;
  const r = render(
    <MealsProvider value={ctrl}>
      <CustomFoodModal target={{} as CustomTarget} initial={null} />
    </MealsProvider>,
  );
  return { ...r, saveCustom };
}

describe('CustomFoodModal Enter-submit (B-087)', () => {
  it('saves on Enter when kcal is a positive number', () => {
    const { getByLabelText, saveCustom } = renderModal();
    const kcal = getByLabelText(i18n.t('meals.card.calories')) as HTMLInputElement;
    fireEvent.change(kcal, { target: { value: '250' } });
    fireEvent.keyDown(kcal, { key: 'Enter' });
    expect(saveCustom).toHaveBeenCalledTimes(1);
    const [, payload] = saveCustom.mock.calls[0] ?? [];
    expect(payload).toMatchObject({ kcal: 250 });
  });

  it('does nothing on Enter when kcal is empty (invalid)', () => {
    const { getByLabelText, saveCustom } = renderModal();
    const kcal = getByLabelText(i18n.t('meals.card.calories')) as HTMLInputElement;
    fireEvent.keyDown(kcal, { key: 'Enter' });
    expect(saveCustom).not.toHaveBeenCalled();
  });
});
