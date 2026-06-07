import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PantryItem } from '@macronome/shared';
import '../../../i18n/config';
import { PantryEditor } from './PantryEditor';

// GM-2 — the per-food prefill unit selector (B-094) and the food picker outside-click (B-095,
// the B-049 pattern). The pantry mutations + food lookups are mocked so the test only exercises
// the component behaviour.
const mocks = vi.hoisted(() => ({
  create: { mutateAsync: vi.fn().mockResolvedValue({}) },
  update: { mutate: vi.fn() },
  remove: { mutate: vi.fn() },
  search: { data: { data: [{ id: 'f9', name: 'Banane' }] } },
  food: {
    data: {
      data: { name: 'Flocons', named_portions: [{ id: 'p1', label: 'tranche', grams: 30 }] },
    },
  },
}));

vi.mock('../usePantry', () => ({
  usePantryMutations: () => ({ create: mocks.create, update: mocks.update, remove: mocks.remove }),
}));
vi.mock('../useFoodPicker', () => ({ useFoodSearch: () => mocks.search }));
vi.mock('../../meals/hooks/useFoodLookup', () => ({ useFood: () => mocks.food }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const item: PantryItem = {
  id: 'i1',
  meal_slot_name: 'Petit déjeuner',
  food_id: 'f1',
  unit: 'g',
  portion_id: null,
  order_index: 0,
};

function renderEditor(items: PantryItem[] = [item]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PantryEditor mealSlotName="Petit déjeuner" items={items} />
    </QueryClientProvider>,
  );
}

describe('PantryEditor — pinned food name resolved per id (B-102)', () => {
  it('labels each pinned chip with the food name from useFood, not a capped index', () => {
    renderEditor();
    // The chip shows the real food name (resolved per id via useFood), never a "—" dash.
    expect(screen.getByText('Flocons')).toBeTruthy();
  });
});

describe('PantryEditor — per-food prefill unit (B-094)', () => {
  it('opens the food unit menu and persists the chosen unit', () => {
    renderEditor();
    // The chip shows the current unit ('g'); clicking it opens the menu.
    fireEvent.click(screen.getByRole('button', { name: 'g' }));
    // The menu offers the SI units + the food's named portion.
    expect(screen.getByRole('button', { name: 'tranche (30 g)' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'ml' }));
    expect(mocks.update.mutate).toHaveBeenCalledWith({
      id: 'i1',
      body: { unit: 'ml', portion_id: null },
    });
  });
});

describe('PantryEditor — food picker outside-click (B-095)', () => {
  it('closes the picker on an outside mousedown without adding a food', () => {
    renderEditor([]);
    fireEvent.click(screen.getByRole('button', { name: '+ Aliment' }));
    expect(screen.getByRole('combobox')).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(mocks.create.mutateAsync).not.toHaveBeenCalled();
  });
});
