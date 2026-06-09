import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Food } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { foodsApi } from '../../../api/foods';
import { FoodModal } from './FoodModal';

// AI meal-proposals S3 (B-123): the food add/edit modal exposes the `ai_proposable`
// toggle ("Dispo pour recettes IA") as a segmented Oui/Non control. New foods default
// ON; toggling Non persists `ai_proposable: false`; editing hydrates from the stored value.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

function renderModal(food: Food | null) {
  return render(
    <FoodModal food={food} isDuplicate={() => false} onClose={vi.fn()} onArchive={vi.fn()} />,
    {
      wrapper,
    },
  );
}

function editableFood(aiProposable: boolean): Food {
  return {
    id: 'f1',
    name: 'Yaourt grec',
    kcal_per_100g: 60,
    fat_per_100g: 0,
    carb_per_100g: 4,
    protein_per_100g: 10,
    comment: null,
    rating: 2,
    visibility: 'private',
    ai_proposable: aiProposable,
    named_portions: [],
    archived_at: null,
  } as unknown as Food;
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

describe('FoodModal — ai_proposable toggle (S3 / B-123)', () => {
  it('defaults a new food to ai_proposable: true on save', async () => {
    const createSpy = vi.spyOn(foodsApi, 'create').mockResolvedValue({ data: editableFood(true) });
    const { getByLabelText, getByRole } = renderModal(null);

    fireEvent.change(getByLabelText(i18n.t('foods.field.name')), {
      target: { value: 'Blanc de poulet' },
    });
    fireEvent.click(getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ ai_proposable: true });
  });

  it('persists ai_proposable: false when the user picks Non', async () => {
    const createSpy = vi.spyOn(foodsApi, 'create').mockResolvedValue({ data: editableFood(false) });
    const { getByLabelText, getByRole } = renderModal(null);

    fireEvent.change(getByLabelText(i18n.t('foods.field.name')), {
      target: { value: 'Blanc de poulet' },
    });
    fireEvent.click(getByRole('button', { name: i18n.t('common.no') }));
    fireEvent.click(getByRole('button', { name: i18n.t('common.save') }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]).toMatchObject({ ai_proposable: false });
  });

  it('hydrates the toggle from an existing food (Non pressed when stored false)', () => {
    const { getByRole } = renderModal(editableFood(false));
    expect(getByRole('button', { name: i18n.t('common.no') }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(getByRole('button', { name: i18n.t('common.yes') }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});
