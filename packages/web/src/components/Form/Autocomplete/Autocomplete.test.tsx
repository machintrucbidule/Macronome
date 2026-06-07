import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Autocomplete, type AutocompleteItem } from './Autocomplete';

// B-023: the first suggestion is highlighted by default, so Enter selects it without an
// explicit ↑/↓; ↑/↓ move the highlight; Enter with no suggestions does nothing.
afterEach(cleanup);

const ITEMS: AutocompleteItem[] = [
  { id: 'a', name: 'Avocat' },
  { id: 'b', name: 'Banane' },
  { id: 'c', name: 'Carotte' },
];

function renderAc(items: AutocompleteItem[], onPick = vi.fn(), opts: { query?: string } = {}) {
  const onClose = vi.fn();
  const { container } = render(
    <Autocomplete
      query={opts.query ?? 'a'}
      onQueryChange={vi.fn()}
      items={items}
      emptyLabel="Aucun"
      onPick={onPick}
      onClose={onClose}
      pickOnTab
    />,
  );
  return { input: container.querySelector('input') as HTMLInputElement, onPick, onClose };
}

describe('Autocomplete Enter selection (B-023)', () => {
  it('selects the first suggestion on Enter with no manual highlight', () => {
    const { input, onPick } = renderAc(ITEMS);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(ITEMS[0]);
  });

  it('ArrowDown moves the highlight before Enter selects', () => {
    const { input, onPick } = renderAc(ITEMS);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(ITEMS[1]);
  });

  it('does nothing on Enter when there are no suggestions', () => {
    const { input, onPick } = renderAc([]);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('does not select a disabled first suggestion', () => {
    const { input, onPick } = renderAc([{ id: 'x', name: 'Indispo', disabled: true }, ITEMS[1]!]);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('Autocomplete Tab (Excel-like meal flow, B-105)', () => {
  it('picks the first suggestion on Tab when the query is non-empty', () => {
    const { input, onPick, onClose } = renderAc(ITEMS, vi.fn(), { query: 'a' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onPick).toHaveBeenCalledWith(ITEMS[0]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without picking on Tab when the query is empty (advance to next field)', () => {
    const { input, onPick, onClose } = renderAc(ITEMS, vi.fn(), { query: '   ' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
