import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../../../i18n/config';
import { defaultDirFor } from '../../../components/DataTable/sortDir';
import { RECIPES_DESC_FIRST } from '../RecipesPage';
import { RecipesTable, SORT_KEYS, type SortField } from './RecipesTable';

// RS-1/B-306: every Recettes data column became sortable — the four derived macros and g/portion
// joined Nom, Lot, Portions and Note. These cases pin what the table sends and how a first click
// is oriented; the ordering itself is the server's and is covered by the integration suite.
afterEach(cleanup);

function renderTable(onSort = vi.fn()) {
  render(
    <RecipesTable
      slots={[]}
      head={0}
      pitch={0}
      sort="name"
      dir="asc"
      onSort={onSort}
      onOpen={vi.fn()}
      onArchive={vi.fn()}
      onRestore={vi.fn()}
    />,
  );
  return onSort;
}

describe('RecipesTable — sortable headers (B-306)', () => {
  it('makes every data column a sortable header', () => {
    renderTable();
    // Nine data columns + the unlabelled actions cell, none of the nine inert any more.
    expect(screen.getAllByRole('columnheader')).toHaveLength(SORT_KEYS.length + 1);
    expect(screen.getAllByRole('button')).toHaveLength(SORT_KEYS.length);
  });

  it('sends each column its own sort key', () => {
    const onSort = renderTable();
    const headers = screen.getAllByRole('button');
    for (const [i, key] of SORT_KEYS.entries()) {
      onSort.mockClear();
      fireEvent.click(headers[i] as HTMLElement);
      expect(onSort).toHaveBeenCalledWith(key);
    }
  });

  it('opens the five new columns descending on a first click (B-299)', () => {
    const numeric: SortField[] = ['kcal', 'fat', 'carb', 'protein', 'weight_per_portion'];
    for (const field of numeric) expect(defaultDirFor(field, RECIPES_DESC_FIRST)).toBe('desc');
    // Nom is the one text column, and the default sort on load, so it stays alphabetical.
    expect(defaultDirFor('name', RECIPES_DESC_FIRST)).toBe('asc');
  });
});
