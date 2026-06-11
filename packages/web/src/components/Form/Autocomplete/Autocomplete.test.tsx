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

function renderWithCustom(query: string) {
  const { container } = render(
    <Autocomplete
      query={query}
      onQueryChange={vi.fn()}
      items={ITEMS}
      emptyLabel="Aucun"
      customOptionLabel="+ Valeurs manuelles"
      onPick={vi.fn()}
      onCustom={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  const custom = container.querySelector('[class*="customOpt"]') as HTMLElement;
  const firstItem = container.querySelector('[role="option"]') as HTMLElement;
  return { custom, firstItem };
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

describe('Autocomplete custom option position (B-159)', () => {
  const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

  it('leads the list when the query is empty (custom before the first item)', () => {
    const { custom, firstItem } = renderWithCustom('');
    // custom precedes firstItem ⇒ firstItem follows custom in document order
    expect(custom.compareDocumentPosition(firstItem) & FOLLOWING).toBeTruthy();
  });

  it('treats a whitespace-only query as empty (custom still leads)', () => {
    const { custom, firstItem } = renderWithCustom('   ');
    expect(custom.compareDocumentPosition(firstItem) & FOLLOWING).toBeTruthy();
  });

  it('trails the list once the user types (custom after the first item)', () => {
    const { custom, firstItem } = renderWithCustom('a');
    expect(firstItem.compareDocumentPosition(custom) & FOLLOWING).toBeTruthy();
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
