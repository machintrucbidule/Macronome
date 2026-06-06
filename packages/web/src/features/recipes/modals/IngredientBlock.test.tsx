import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../../../i18n/config';
import { IngredientBlock } from './IngredientBlock';
import type { IngredientDraft } from './draft';

// B-034: an already-added ingredient's name must reopen the picker to change it (parity with
// the daily-log inline edit). Before the fix the name was an inert <span>.
afterEach(() => cleanup());

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
