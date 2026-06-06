import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LeftoverPreviewLine, MealEntry } from '@macronome/shared';
import '../../../../i18n/config';
import { LeftoverPreview } from './LeftoverPreview';

// B-047: the served → consumed preview table renders each selected line's served weight and
// the (smaller) consumed weight returned by the server preview endpoint.
afterEach(() => cleanup());

const customLine: MealEntry = {
  id: 'e1',
  kind: 'custom',
  food_id: null,
  custom_name: 'Riz',
  served_quantity: 500,
  unit: 'g',
  portion_id: null,
  served_grams: 500,
  snap: { kcal: 0, fat: 0, carb: 0, protein: 0 },
  consumed: { grams: 500, quantity: 500, kcal: 0, fat: 0, carb: 0, protein: 0 },
  is_pinned: false,
  order_index: 0,
};

function renderPreview(entries: MealEntry[], lines: LeftoverPreviewLine[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LeftoverPreview entries={entries} lines={lines} />
    </QueryClientProvider>,
  );
}

describe('LeftoverPreview (B-047)', () => {
  it('renders served → consumed for each selected line', () => {
    const { getByText } = renderPreview(
      [customLine],
      [{ entry_id: 'e1', served_grams: 500, consumed_grams: 450 }],
    );
    expect(getByText('Riz')).toBeTruthy();
    expect(getByText('500 g')).toBeTruthy();
    expect(getByText('450 g')).toBeTruthy();
  });

  it('renders nothing when there is no selected line', () => {
    const { container } = renderPreview([], []);
    expect(container.firstChild).toBeNull();
  });
});
