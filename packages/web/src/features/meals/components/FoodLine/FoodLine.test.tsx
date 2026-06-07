import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MealEntry } from '@macronome/shared';
import '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import type { LineDnd } from '../../hooks/useLineDnd';
import { FoodLine } from './FoodLine';

// B-105: Tab follows the name↔qty serpentine (meals.md §113) — the food name is a keyboard
// tab stop, while the pin (📌) and delete (×) icons are out of the tab order (tabindex=-1).
afterEach(() => cleanup());

const dnd: LineDnd = {
  dragId: null,
  onDragStart: vi.fn(),
  onDragEnd: vi.fn(),
  onDrop: vi.fn(),
};

function entry(): MealEntry {
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
  };
}

function renderLine() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ctrl = {
    actions: {
      setQty: vi.fn(),
      clearFocus: vi.fn(),
      startEdit: vi.fn(),
      openCustom: vi.fn(),
      deleteEntry: vi.fn(),
      togglePin: vi.fn(),
    },
    pendingFocus: null,
  } as unknown as MealsController;
  return render(
    <QueryClientProvider client={qc}>
      <MealsProvider value={ctrl}>
        <FoodLine mealId="m1" mealIndex={0} row={0} entry={entry()} editing={false} dnd={dnd} />
      </MealsProvider>
    </QueryClientProvider>,
  );
}

describe('FoodLine keyboard tab order (B-105)', () => {
  it('makes the name a tab stop and keeps the pin/delete icons out of the tab order', () => {
    const { container } = renderLine();
    const name = container.querySelector('[role="button"]');
    expect(name?.getAttribute('tabindex')).toBe('0');

    const buttons = [...container.querySelectorAll('button')];
    expect(buttons).toHaveLength(2); // pin + delete
    for (const b of buttons) expect(b.getAttribute('tabindex')).toBe('-1');
  });
});
