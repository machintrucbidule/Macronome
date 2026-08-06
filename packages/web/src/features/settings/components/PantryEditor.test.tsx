import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PantryItem } from '@macronome/shared';
import '../../../i18n/config';
import { foodsApi } from '../../../api/foods';
import { PantryEditor } from './PantryEditor';

// GM-2 — the per-food prefill unit selector (B-094) and the food picker outside-click (B-095,
// the B-049 pattern). The pantry mutations + food lookups are mocked so the test only exercises
// the component behaviour.
const mocks = vi.hoisted(() => ({
  create: { mutateAsync: vi.fn().mockResolvedValue({}) },
  update: { mutate: vi.fn() },
  remove: { mutate: vi.fn() },
  search: {
    data: { data: [{ id: 'f9', name: 'Banane', kind: 'food', origin: 'own', named_portions: [] }] },
  },
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

// Desktop by default (as jsdom reports); the MOB-1 block below flips it.
const { isMobile } = vi.hoisted(() => ({ isMobile: { value: false } }));
vi.mock('../../../lib/useIsMobile', () => ({ useIsMobile: () => isMobile.value }));

const DEFAULT_RESULTS = mocks.search.data;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  isMobile.value = false;
  // The Ciqual block below swaps the picker results; restore them so order cannot matter.
  mocks.search.data = DEFAULT_RESULTS;
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

// MOB-1: at ≤560px the picker is the shared sheet. The outside-click listener above must be off
// there — the sheet is portalled outside this card, so it would dismiss on the first tap inside.
describe('PantryEditor — picker sheet on phones (MOB-1)', () => {
  it('opens the sheet instead of the inline dropdown', () => {
    isMobile.value = true;
    renderEditor([]);
    fireEvent.click(screen.getByRole('button', { name: '+ Aliment' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Ajouter au garde-manger')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  // Pinning is async since B-293: a Ciqual entry is adopted first, so every pick resolves.
  it('pins the tapped food', async () => {
    isMobile.value = true;
    renderEditor([]);
    fireEvent.click(screen.getByRole('button', { name: '+ Aliment' }));

    fireEvent.click(screen.getByRole('button', { name: /Banane/ }));
    await waitFor(() =>
      expect(mocks.create.mutateAsync).toHaveBeenCalledWith({
        meal_slot_name: 'Petit déjeuner',
        food_id: 'f9',
      }),
    );
  });

  it('does not close on an outside mousedown (the sheet has its own close paths)', () => {
    isMobile.value = true;
    renderEditor([]);
    fireEvent.click(screen.getByRole('button', { name: '+ Aliment' }));

    fireEvent.mouseDown(document.body);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

// B-293 acceptance, pantry family. This picker used to query GET /foods, which made it the only
// one of the three without recipes and without Ciqual; it now shares /search/loggable.
describe('PantryEditor — Ciqual entries (B-293)', () => {
  const CIQUAL = {
    id: 'ref-1',
    name: 'Banane, pulpe, crue',
    kind: 'food',
    origin: 'ciqual_ref',
    named_portions: [],
  };

  it('marks a reference entry and leaves the user own results unmarked', () => {
    isMobile.value = true;
    mocks.search.data = { data: [...DEFAULT_RESULTS.data, CIQUAL] };
    renderEditor([]);
    fireEvent.click(screen.getByRole('button', { name: '+ Aliment' }));

    expect(screen.getByRole('button', { name: /Banane, pulpe, crue.*Ciqual/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Banane$/ })).toBeTruthy();
  });

  it('adopts a reference entry, then pins the real food', async () => {
    isMobile.value = true;
    mocks.search.data = { data: [CIQUAL] };
    const spy = vi.spyOn(foodsApi, 'createFromRef').mockResolvedValue({
      data: { id: 'new-food', named_portions: [] },
    } as unknown as Awaited<ReturnType<typeof foodsApi.createFromRef>>);
    renderEditor([]);
    fireEvent.click(screen.getByRole('button', { name: '+ Aliment' }));

    fireEvent.click(screen.getByRole('button', { name: /Banane, pulpe, crue/ }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ ref_id: 'ref-1', locale: 'fr' }));
    // The pin points at the NEW food id, never the reference id.
    await waitFor(() =>
      expect(mocks.create.mutateAsync).toHaveBeenCalledWith({
        meal_slot_name: 'Petit déjeuner',
        food_id: 'new-food',
      }),
    );
  });
});
