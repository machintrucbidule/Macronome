import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LeftoverGroup, Meal } from '@macronome/shared';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { LeftoverModal } from './LeftoverModal';

// B-047 follow-up: with no applied leftover the modal opens the create form directly (no empty
// intermediate list); with existing leftovers it opens the list.
vi.mock('../../../containers/useContainers', () => ({
  useContainers: () => ({ data: { data: [] } }),
}));

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
});

const GROUP: LeftoverGroup = {
  id: 'g1',
  container_name: 'Bol',
  tare_g: 408,
  gross_grams: 508,
  leftover_net_grams: 100,
  entry_ids: ['e1'],
};

function meal(groups: LeftoverGroup[]): Meal {
  return {
    id: 'm1',
    slot_name: 'Dîner',
    order_index: 0,
    entries: [],
    leftover_groups: groups,
    totals: { kcal: 0, fat: 0, carb: 0, protein: 0, weight_g: 0 },
  };
}

function renderModal(groups: LeftoverGroup[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const noop = { isPending: false, mutateAsync: vi.fn() };
  const ctrl = {
    actions: { closeLeftover: vi.fn() },
    mutations: { createLeftover: noop, updateLeftover: noop, removeLeftover: noop },
  } as unknown as MealsController;
  return render(
    <QueryClientProvider client={qc}>
      <MealsProvider value={ctrl}>
        <LeftoverModal meal={meal(groups)} />
      </MealsProvider>
    </QueryClientProvider>,
  );
}

describe('LeftoverModal initial view (B-047)', () => {
  it('opens the create form directly when no leftover is applied', () => {
    const { getByTestId, queryByText } = renderModal([]);
    expect(getByTestId('lo-gross')).toBeTruthy(); // create form
    expect(queryByText(/Nouveau reste/)).toBeNull(); // not the list
  });

  it('opens the list when leftovers already exist', () => {
    const { getByText, queryByTestId } = renderModal([GROUP]);
    expect(getByText('Bol')).toBeTruthy();
    expect(getByText(/Nouveau reste/)).toBeTruthy();
    expect(queryByTestId('lo-gross')).toBeNull(); // not the create form
  });
});
