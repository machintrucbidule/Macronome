import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MealEntry } from '@macronome/shared';
import '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { QtyCell } from './QtyCell';

// B-047: the Qté field shows the CONSUMED quantity at rest but edits the SERVED quantity.
// A focus/blur without a keystroke must not overwrite served with the consumed value.
afterEach(() => cleanup());

function entry(over: Partial<MealEntry> = {}): MealEntry {
  return {
    id: 'e1',
    kind: 'referenced',
    food_id: 'f1',
    custom_name: null,
    served_quantity: 200,
    unit: 'g',
    portion_id: null,
    served_grams: 200,
    snap: { kcal: 0, fat: 0, carb: 0, protein: 0 },
    consumed: { grams: 200, quantity: 200, kcal: 0, fat: 0, carb: 0, protein: 0 },
    is_pinned: false,
    order_index: 0,
    ...over,
  };
}

function renderQty(e: MealEntry, setQty = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ctrl = {
    actions: { setQty, clearFocus: vi.fn() },
    pendingFocus: null,
  } as unknown as MealsController;
  const utils = render(
    <QueryClientProvider client={qc}>
      <MealsProvider value={ctrl}>
        <QtyCell mealId="m1" entry={e} />
      </MealsProvider>
    </QueryClientProvider>,
  );
  return { ...utils, setQty };
}

describe('QtyCell consumed display (B-047)', () => {
  it('shows the consumed quantity at rest when a leftover applies', () => {
    const { getByRole } = renderQty(
      entry({
        served_quantity: 200,
        consumed: { grams: 180, quantity: 180, kcal: 0, fat: 0, carb: 0, protein: 0 },
      }),
    );
    expect((getByRole('textbox') as HTMLInputElement).value).toBe('180');
  });

  it('writes the SERVED quantity when the user types and commits', () => {
    const { getByRole, setQty } = renderQty(entry());
    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.blur(input);
    expect(setQty).toHaveBeenCalledWith('m1', 'e1', 250, 'g', null);
  });

  it('does not overwrite served on a focus/blur without a keystroke', () => {
    const { getByRole, setQty } = renderQty(
      entry({
        served_quantity: 200,
        consumed: { grams: 180, quantity: 180, kcal: 0, fat: 0, carb: 0, protein: 0 },
      }),
    );
    const input = getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(setQty).not.toHaveBeenCalled();
  });
});
