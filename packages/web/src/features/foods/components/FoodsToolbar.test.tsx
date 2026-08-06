import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { sourceFilterOptions, type SourceFilter } from '../sourceFilter';
import { FiltersPopover } from './FiltersPopover';
import { FoodsToolbar } from './FoodsToolbar';

// B-279: the chip used to read "N affichés" — the rows fetched so far, which the owner judged
// useless. It now shows the server-side count of rows matching the current filters, the same
// figure the scrollbar is sized on (B-278).
afterEach(cleanup);

function toolbar(
  count: number | undefined,
  sourceOptions: SourceFilter[] = [],
  addDisabled = false,
) {
  return render(
    <FoodsToolbar
      count={count}
      countKey="foods.count"
      q=""
      onQ={vi.fn()}
      onAdd={vi.fn()}
      addDisabled={addDisabled}
      filters={
        <FiltersPopover
          minRating={0}
          visibility="all"
          source="all"
          sourceOptions={sourceOptions}
          showArchived={false}
          onMinRating={vi.fn()}
          onVisibility={vi.fn()}
          onSource={vi.fn()}
          onShowArchived={vi.fn()}
        />
      }
    />,
  );
}

describe('FoodsToolbar count (B-279)', () => {
  it('counts the catalogue, not the loaded page', () => {
    toolbar(412);
    expect(screen.getByText(i18n.t('foods.count', { count: 412 }))).toBeTruthy();
  });

  it('says nothing before the first page reports a total', () => {
    const { container } = toolbar(undefined);
    // An empty chip, not "0": a zero would read as an empty catalogue for a moment.
    expect(container.textContent).not.toMatch(/\d/);
  });

  it('reads the singular for a single match', () => {
    toolbar(1);
    expect(screen.getByText(i18n.t('foods.count', { count: 1 }))).toBeTruthy();
  });

  it('shows zero when nothing matches, rather than staying blank', () => {
    toolbar(0);
    expect(screen.getByText(i18n.t('foods.count', { count: 0 }))).toBeTruthy();
  });
});

// B-295: a provenance is offered only when a food carries it, and the whole Source block stays
// out of the popover below two — filtering on the single source everything already has could
// not change the list.
describe('FoodsToolbar source filter availability (B-295)', () => {
  it('offers no Source block while every food shares one provenance', () => {
    expect(sourceFilterOptions(['manual'])).toEqual([]);
    const { getByRole, queryByText } = toolbar(3, sourceFilterOptions(['manual']));
    fireEvent.click(getByRole('button', { name: /Filtres/ }));
    expect(queryByText(i18n.t('foods.filters.source'))).toBeNull();
  });

  it('offers the block, and only the provenances present, once a second one appears', () => {
    const options = sourceFilterOptions(['ciqual', 'manual']);
    expect(options).toEqual(['all', 'ciqual', 'manual']);
    const { getByRole, getByText, queryByText } = toolbar(3, options);
    fireEvent.click(getByRole('button', { name: /Filtres/ }));
    expect(getByText(i18n.t('foods.filters.source'))).toBeTruthy();
    expect(getByText(i18n.t('foods.source.ciqual'))).toBeTruthy();
    expect(queryByText(i18n.t('foods.source.chronodrive'))).toBeNull();
  });

  it('never offers `recipe`, which the Aliments list cannot show anyway', () => {
    expect(sourceFilterOptions(['manual', 'recipe'])).toEqual([]);
    expect(sourceFilterOptions(['ciqual', 'manual', 'recipe'])).toEqual([
      'all',
      'ciqual',
      'manual',
    ]);
  });
});

// B-292: in Catalogue Ciqual mode, adding happens per row — the toolbar's "+ Ajouter un aliment"
// is greyed rather than removed, so switching mode does not move the toolbar's geometry.
describe('FoodsToolbar add button across modes (B-292)', () => {
  it('is enabled in Mes aliments and disabled in the catalog', () => {
    const enabled = toolbar(3);
    expect(
      (enabled.getByRole('button', { name: i18n.t('foods.add') }) as HTMLButtonElement).disabled,
    ).toBe(false);
    cleanup();

    const disabled = toolbar(3, [], true);
    expect(
      (disabled.getByRole('button', { name: i18n.t('foods.add') }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
