import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/config';
import { SearchSheet, type SearchSheetItem } from './SearchSheet';

// The shared picker sheet (design/components/modals.md §The shared picker sheet, MOB-1). Rendered
// directly, bypassing the useIsMobile() gate its hosts apply — jsdom reports desktop.
const ITEMS: SearchSheetItem[] = [
  { id: 'f1', name: 'Flocons' },
  { id: 'r1', name: 'Gratin', tag: 'recette' },
];

function renderSheet(overrides: Partial<Parameters<typeof SearchSheet>[0]> = {}) {
  const props = {
    title: 'Ajouter un aliment',
    placeholder: 'Rechercher…',
    emptyLabel: 'Aucun résultat',
    query: '',
    onQueryChange: vi.fn(),
    items: ITEMS,
    onPick: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SearchSheet {...props} />);
  return props;
}

afterEach(() => {
  cleanup();
});

describe('SearchSheet', () => {
  // B-206: the sheet must land focus on its search field, not the header ×, or the mobile keyboard
  // never opens.
  it('focuses the search input on open', () => {
    renderSheet();
    expect(document.activeElement).toBe(document.querySelector('input'));
  });

  it('renders one row per item, with its tag', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: /Flocons/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Gratin.*recette/ })).toBeTruthy();
  });

  // B-293: the whole item travels, not just its id — a Ciqual reference id is not a food id,
  // and a host that looked the pick back up by id could not tell the two apart.
  it('reports the picked item', () => {
    const { onPick } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /Flocons/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1' }));
  });

  // The recipe builder needs this: a recipe that would create a cycle is shown but must be
  // unselectable, otherwise a phone user picks it and the save is refused (recipe.md).
  it('does not report a pick for a disabled row', () => {
    const { onPick } = renderSheet({
      items: [{ id: 'r1', name: 'Elle-même', tag: 'recette', disabled: true }],
    });
    const row = screen.getByRole('button', { name: /Elle-même/ });
    expect(row).toHaveProperty('disabled', true);
    fireEvent.click(row);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('shows the empty label when there are no items', () => {
    renderSheet({ items: [] });
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
  });

  it('renders no custom row when the host offers none', () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: /manuelles/ })).toBeNull();
  });

  // B-159: leading while the field is empty, trailing once the user types, so the first row is
  // always the best match. Asserted on DOM order against the first result row.
  it('places the custom option first when the query is empty and last once typing', () => {
    const custom = { customLabel: '+ Valeurs manuelles', onCustom: vi.fn() };
    renderSheet(custom);
    let rows = screen.getAllByRole('button');
    expect(rows[0]?.textContent).toContain('Valeurs manuelles');
    cleanup();

    renderSheet({ ...custom, query: 'flo' });
    rows = screen.getAllByRole('button');
    expect(rows.at(-1)?.textContent).toContain('Valeurs manuelles');
    expect(rows[0]?.textContent).toContain('Flocons');
  });

  it('treats a whitespace-only query as empty for the custom option', () => {
    renderSheet({ customLabel: '+ Valeurs manuelles', onCustom: vi.fn(), query: '   ' });
    expect(screen.getAllByRole('button')[0]?.textContent).toContain('Valeurs manuelles');
  });
});
