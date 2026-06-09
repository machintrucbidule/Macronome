import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DayDetail, MealSuggestionsResponse } from '@macronome/shared';
import i18n from '../../../i18n/config';
import { aiApi } from '../../../api/ai';
import { AiProposalsDialog } from './AiProposalsDialog';

// AI meal-proposals S9 (B-123): the request popup. "Proposer" is gated on ≥1 selected meal; a
// submit calls POST /ai/meal-suggestions (mocked) with the selected meal ids + the note. The
// remaining-target cards are derived on the page from the already-loaded day (display only).
const DAY: DayDetail = {
  date: '2026-06-09',
  kind: 'detailed',
  activity_level: 'sedentary',
  comment: null,
  verdict_auto: null,
  verdict_override: null,
  effective_verdict: null,
  target_snapshot: {
    cal_min: 1550,
    cal_max: 1650,
    protein_floor_g: 140,
    fat_floor_g: 50,
    carb_ceiling_g: 150,
  },
  totals: { kcal: 920, fat: 28, carb: 70, protein: 78, weight_g: 0 },
  constat: {
    estimated_burn: null,
    deficit: null,
    kg_per_week: null,
    per_level_activity_burn: null,
  },
  meals: [
    {
      id: 'm1',
      slot_name: 'Dîner',
      order_index: 0,
      entries: [],
      leftover_groups: [],
      totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
    },
    {
      id: 'm2',
      slot_name: 'Collation',
      order_index: 1,
      entries: [],
      leftover_groups: [],
      totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
    },
  ],
};

const RESPONSE: MealSuggestionsResponse = {
  data: {
    remaining: {
      cal_min: 630,
      cal_max: 730,
      need_protein_g: 62,
      need_fat_g: 22,
      carb_room_g: 80,
      entered: { kcal: 920, fat: 28, carb: 70, protein: 78 },
    },
    proposals: [],
  },
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

describe('AiProposalsDialog — request popup (S9 / B-123)', () => {
  it('shows the remaining-target cards derived from the day', () => {
    const { getByText } = render(
      <AiProposalsDialog day={DAY} date="2026-06-09" onClose={vi.fn()} />,
      { wrapper },
    );
    // cal band 1550–1650 − 920 entered = 630–730; protein floor 140 − 78 = 62.
    expect(getByText('630–730')).toBeTruthy();
    expect(getByText(i18n.t('meals.proposals.remaining.floor', { n: '62' }))).toBeTruthy();
  });

  it('keeps "Proposer" disabled until at least one meal is selected', () => {
    const { getByRole } = render(
      <AiProposalsDialog day={DAY} date="2026-06-09" onClose={vi.fn()} />,
      { wrapper },
    );
    const propose = getByRole('button', { name: i18n.t('meals.proposals.propose') });
    expect((propose as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(getByRole('checkbox', { name: /Dîner/ }));
    expect((propose as HTMLButtonElement).disabled).toBe(false);
  });

  it('submits the selected meal ids + note to the mocked endpoint', async () => {
    const spy = vi.spyOn(aiApi, 'mealSuggestions').mockResolvedValue(RESPONSE);
    const { getByRole, getByPlaceholderText } = render(
      <AiProposalsDialog day={DAY} date="2026-06-09" onClose={vi.fn()} />,
      { wrapper },
    );

    fireEvent.click(getByRole('checkbox', { name: /Collation/ }));
    fireEvent.change(getByPlaceholderText(i18n.t('meals.proposals.notePlaceholder')), {
      target: { value: 'pas de laitages' },
    });
    fireEvent.click(getByRole('button', { name: i18n.t('meals.proposals.propose') }));

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0]?.[0]).toEqual({
      date: '2026-06-09',
      meal_ids: ['m2'],
      note: 'pas de laitages',
    });
  });
});
