import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import { FoodsToolbar } from './FoodsToolbar';

// B-279: the chip used to read "N affichés" — the rows fetched so far, which the owner judged
// useless. It now shows the server-side count of rows matching the current filters, the same
// figure the scrollbar is sized on (B-278).
afterEach(cleanup);

function toolbar(count: number | undefined) {
  return render(
    <FoodsToolbar
      count={count}
      q=""
      minRating={0}
      visibility="all"
      showArchived={false}
      onQ={vi.fn()}
      onMinRating={vi.fn()}
      onVisibility={vi.fn()}
      onShowArchived={vi.fn()}
      onAdd={vi.fn()}
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
