import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LoggableItem } from '@macronome/shared';
import '../../../../i18n/config';
import { foodsApi } from '../../../../api/foods';
import type { EditTarget } from '../../hooks/mealActions';
import { FoodPickerSheet } from './FoodPickerSheet';

// The pickers adopt a Ciqual entry on pick (B-293), which is a mutation — so they need a client.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

// B-206: the mobile food picker must focus its search input on open (so the keyboard opens),
// not the modal's header "×". The focus lands via the Modal focus-trap initial-focus target
// (initialFocusRef) — asserted here through document.activeElement. The open-keyboard reflow is
// not jsdom-observable and is checked visually on a device.

const { mocks, search } = vi.hoisted(() => ({
  mocks: { pickFood: vi.fn(), openCustom: vi.fn(), closeEdit: vi.fn() },
  search: { data: { data: [] as LoggableItem[] } },
}));
vi.mock('../../MealsContext', () => ({
  useMeals: () => ({ actions: mocks, day: null }),
}));
vi.mock('../../hooks/useFoodLookup', () => ({ useFoodSearch: () => search }));

const CIQUAL: LoggableItem = {
  id: 'ref-1',
  name: 'Pomme, chair et peau, crue',
  kind: 'food',
  origin: 'ciqual_ref',
  recipe_id: null,
  named_portions: [],
};
const OWN: LoggableItem = {
  id: 'f1',
  name: 'Pomme maison',
  kind: 'food',
  origin: 'own',
  recipe_id: null,
  named_portions: [],
};

const target: EditTarget = {
  mealId: 'm1',
  mealIndex: 0,
  entryId: null,
  orderIndex: null,
  initialQuery: '',
};

afterEach(() => {
  cleanup();
  search.data = { data: [] };
  vi.clearAllMocks();
});

describe('FoodPickerSheet', () => {
  it('focuses the search input on open', () => {
    render(<FoodPickerSheet target={target} />, { wrapper });
    const input = document.querySelector('input');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });
});

// B-293 acceptance, meals family.
describe('FoodPickerSheet — Ciqual entries (B-293)', () => {
  it('marks a reference entry and leaves the user own results unmarked', () => {
    search.data = { data: [OWN, CIQUAL] };
    render(<FoodPickerSheet target={target} />, { wrapper });

    expect(screen.getByRole('button', { name: /Pomme, chair et peau, crue.*Ciqual/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Pomme maison.*Ciqual/ })).toBeNull();
  });

  it('adopts a reference entry, then logs the real food', async () => {
    search.data = { data: [CIQUAL] };
    const spy = vi.spyOn(foodsApi, 'createFromRef').mockResolvedValue({
      data: { id: 'new-food', named_portions: [] },
    } as unknown as Awaited<ReturnType<typeof foodsApi.createFromRef>>);
    render(<FoodPickerSheet target={target} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /Pomme, chair et peau, crue/ }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ ref_id: 'ref-1', locale: 'fr' }));
    // The line references the NEW food id, never the reference id.
    await waitFor(() =>
      expect(mocks.pickFood).toHaveBeenCalledWith(expect.anything(), 'new-food', []),
    );
  });
});
