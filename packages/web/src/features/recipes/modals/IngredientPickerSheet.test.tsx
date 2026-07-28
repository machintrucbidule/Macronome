import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { LoggableItem } from '@macronome/shared';
import '../../../i18n/config';
import { IngredientPickerSheet } from './IngredientPickerSheet';

// The ingredient picker on phones (MOB-1). Rendered directly — its host applies the useIsMobile()
// gate, and jsdom reports desktop.
const FLOUR: LoggableItem = {
  id: 'f1',
  name: 'Flour',
  kind: 'food',
  recipe_id: null,
  named_portions: [],
};
const SELF: LoggableItem = {
  id: 'r1',
  name: 'This very recipe',
  kind: 'recipe',
  recipe_id: 'rec1',
  named_portions: [],
};

const { search } = vi.hoisted(() => ({ search: { data: { data: [] as LoggableItem[] } } }));
vi.mock('../useRecipes', () => ({ useLoggableSearch: () => search }));

afterEach(() => {
  cleanup();
  search.data = { data: [] };
});

describe('IngredientPickerSheet', () => {
  it('returns the full picked item, not just its id (the caller needs its portions)', () => {
    search.data = { data: [FLOUR] };
    const onPick = vi.fn();
    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing={false}
        onPick={onPick}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Flour/ }));
    expect(onPick).toHaveBeenCalledWith(FLOUR);
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
    );
    expect(screen.getByRole('button', { name: /recette/ })).toBeTruthy();
  });

  it('titles itself for adding vs replacing, and pre-fills the search when replacing', () => {
    render(
      <IngredientPickerSheet
        disabledFoodId={null}
        replacing={false}
        onPick={vi.fn()}
        onClose={vi.fn()}
      />,
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
    );
    expect(screen.queryByRole('button', { name: /manuelles/ })).toBeNull();
  });
});
