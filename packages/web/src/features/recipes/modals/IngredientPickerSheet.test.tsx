import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LoggableItem } from '@macronome/shared';
import '../../../i18n/config';
import { foodsApi } from '../../../api/foods';
import { IngredientPickerSheet } from './IngredientPickerSheet';

// The pickers adopt a Ciqual entry on pick (B-293), which is a mutation — so they need a client.
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

// The ingredient picker on phones (MOB-1). Rendered directly — its host applies the useIsMobile()
// gate, and jsdom reports desktop.
const FLOUR: LoggableItem = {
  id: 'f1',
  name: 'Flour',
  kind: 'food',
  origin: 'own',
  recipe_id: null,
  named_portions: [],
};
const SELF: LoggableItem = {
  id: 'r1',
  name: 'This very recipe',
  kind: 'recipe',
  origin: 'own',
  recipe_id: 'rec1',
  named_portions: [],
};

const CIQUAL: LoggableItem = {
  id: 'ref-1',
  name: 'Farine de blé tendre',
  kind: 'food',
  origin: 'ciqual_ref',
  recipe_id: null,
  named_portions: [],
};

const { search } = vi.hoisted(() => ({ search: { data: { data: [] as LoggableItem[] } } }));
vi.mock('../useRecipes', () => ({ useLoggableSearch: () => search }));

afterEach(() => {
  cleanup();
  search.data = { data: [] };
});

describe('IngredientPickerSheet', () => {
  // Picking is async since B-293: a Ciqual entry is adopted first, so every pick resolves.
  it('returns the full picked item, not just its id (the caller needs its portions)', async () => {
    search.data = { data: [FLOUR] };
    const onPick = vi.fn();
    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing={false}
        onPick={onPick}
        onClose={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /Flour/ }));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(FLOUR));
  });

  // recipe.md: a recipe that would create a cycle is shown disabled. Without this, a phone user
  // picks it and the save is refused by the server.
  it('disables the edited recipe’s own item so it cannot be picked', () => {
    search.data = { data: [SELF] };
    const onPick = vi.fn();
    render(
      <IngredientPickerSheet
        disabledFoodId="r1"
        replacing={false}
        onPick={onPick}
        onClose={vi.fn()}
      />,
      { wrapper },
    );

    const row = screen.getByRole('button', { name: /This very recipe/ });
    expect(row).toHaveProperty('disabled', true);
    fireEvent.click(row);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('tags a recipe result', () => {
    search.data = { data: [{ ...SELF, id: 'r2' }] };
    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing={false}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: /recette/ })).toBeTruthy();
  });
});

describe('IngredientPickerSheet — chrome', () => {
  it('titles itself for adding vs replacing, and pre-fills the search when replacing', () => {
    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing={false}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText('Ajouter un ingrédient')).toBeTruthy();
    cleanup();

    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing
        initialQuery="Flour"
        currentId="f1"
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.getByText("Remplacer l'ingrédient")).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('Flour');
  });

  // The builder allows no custom-inline ingredients (recipe.md), so the sheet must not offer the row
  // Repas has.
  it('offers no custom-food option', () => {
    search.data = { data: [FLOUR] };
    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing={false}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper },
    );
    expect(screen.queryByRole('button', { name: /manuelles/ })).toBeNull();
  });
});

// B-293 acceptance, recipe family: the grey chip marks what is not yours yet, and picking one
// adopts it before it can become an ingredient.
describe('IngredientPickerSheet — Ciqual entries (B-293)', () => {
  it('marks a reference entry and leaves the user own results unmarked', () => {
    search.data = { data: [FLOUR, CIQUAL] };
    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing={false}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
      { wrapper },
    );

    expect(screen.getByRole('button', { name: /Farine de blé tendre.*Ciqual/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Flour.*Ciqual/ })).toBeNull();
  });

  it('adopts a reference entry, then hands the caller the real food', async () => {
    search.data = { data: [CIQUAL] };
    const adopted = { id: 'new-food', name: 'Farine de blé tendre', named_portions: [] };
    const spy = vi
      .spyOn(foodsApi, 'createFromRef')
      .mockResolvedValue({ data: adopted } as unknown as Awaited<
        ReturnType<typeof foodsApi.createFromRef>
      >);
    const onPick = vi.fn();
    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing={false}
        onPick={onPick}
        onClose={vi.fn()}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /Farine de blé tendre/ }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ ref_id: 'ref-1', locale: 'fr' }));
    // The ingredient references the NEW food id, never the reference id.
    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'new-food', origin: 'own' }),
      ),
    );
  });
});
