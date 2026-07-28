import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../../i18n/config';
import { IngredientBlock } from './IngredientBlock';
import type { IngredientDraft } from './draft';

// B-034: an already-added ingredient's name must reopen the picker to change it (parity with
// the daily-log inline edit). Before the fix the name was an inert <span>.
//
// The cases below exercise the DESKTOP branch: jsdom's matchMedia always reports no match, so
// useIsMobile() is false unless a case mocks it (see the MOB-1 block at the bottom).
const { isMobile } = vi.hoisted(() => ({ isMobile: { value: false } }));
vi.mock('../../../lib/useIsMobile', () => ({ useIsMobile: () => isMobile.value }));

afterEach(() => {
  cleanup();
  isMobile.value = false;
});

const draft: IngredientDraft = {
  refType: 'food',
  refId: 'f1',
  refName: 'Flour',
  namedPortions: [],
  quantity: '100',
  unit: 'g',
  portionId: null,
};

function renderBlock(ingredients: IngredientDraft[], onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <IngredientBlock ingredients={ingredients} disabledFoodId={null} onChange={onChange} />
    </QueryClientProvider>,
  );
  return { ...utils, onChange };
}

describe('IngredientBlock — edit ingredient (B-034)', () => {
  it('clicking an added ingredient name flips the line to the picker', () => {
    renderBlock([draft]);
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByText('Flour'));
    expect(screen.getByRole('combobox')).toBeTruthy();
  });
});

// B-049: the change-picker must open pre-filled with the current ingredient, and an
// outside click must cancel the change while keeping the original line.
describe('IngredientBlock — change picker pre-fill & outside-click (B-049)', () => {
  it('pre-fills the picker with the current ingredient name', () => {
    renderBlock([draft]);
    fireEvent.click(screen.getByText('Flour'));
    expect(screen.getByRole<HTMLInputElement>('combobox').value).toBe('Flour');
  });

  it('clicking outside closes the picker and keeps the original ingredient', () => {
    const { onChange } = renderBlock([draft]);
    fireEvent.click(screen.getByText('Flour'));
    expect(screen.getByRole('combobox')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

// MOB-1: at ≤560px the inline dropdown is replaced by the shared picker sheet. The two must never
// be mounted together — the inline picker closes on a document mousedown outside its own subtree,
// and the sheet is portalled to <body>, so a tap inside it would cancel the edit.
describe('IngredientBlock — picker sheet on phones (MOB-1)', () => {
  it('opens the sheet, not the inline dropdown, when adding', () => {
    isMobile.value = true;
    renderBlock([]);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un ingrédient/ }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Ajouter un ingrédient')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('opens the sheet on an existing line and keeps the line visible', () => {
    isMobile.value = true;
    renderBlock([draft]);
    fireEvent.click(screen.getByText('Flour'));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText("Remplacer l'ingrédient")).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    // The row is not swapped out for a search row on mobile — the sheet overlays it.
    expect(screen.getByText('Flour')).toBeTruthy();
  });

  it('does not mount the sheet on desktop', () => {
    renderBlock([draft]);
    fireEvent.click(screen.getByText('Flour'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('combobox')).toBeTruthy();
  });
});

// B-108: an arithmetic expression typed in an ingredient quantity is evaluated on blur.
describe('IngredientBlock — arithmetic quantity (B-108)', () => {
  function Stateful() {
    const [ings, setIngs] = useState<IngredientDraft[]>([draft]);
    return <IngredientBlock ingredients={ings} disabledFoodId={null} onChange={setIngs} />;
  }

  it('evaluates the expression on blur and stores the result', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Stateful />
      </QueryClientProvider>,
    );
    const qty = screen.getByRole<HTMLInputElement>('textbox');
    fireEvent.change(qty, { target: { value: '950/2' } });
    fireEvent.blur(qty);
    expect(qty.value).toBe('475');
  });
});
