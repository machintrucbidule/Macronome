import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MealEntry } from '@macronome/shared';
import '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import type { LineDnd } from '../../hooks/useLineDnd';
import { FoodLine } from './FoodLine';
import styles from './food-line.module.css';

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

function renderLine(e: MealEntry | null = entry()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const startEdit = vi.fn();
  const ctrl = {
    actions: {
      setQty: vi.fn(),
      clearFocus: vi.fn(),
      startEdit,
      openCustom: vi.fn(),
      deleteEntry: vi.fn(),
      togglePin: vi.fn(),
    },
    pendingFocus: null,
  } as unknown as MealsController;
  const utils = render(
    <QueryClientProvider client={qc}>
      <MealsProvider value={ctrl}>
        <FoodLine mealId="m1" mealIndex={0} row={0} entry={e} editing={false} dnd={dnd} />
      </MealsProvider>
    </QueryClientProvider>,
  );
  return { ...utils, startEdit };
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

  it('opens the picker seeded with a typed character (type-to-search)', () => {
    const { container, startEdit } = renderLine();
    const name = container.querySelector('[role="button"]') as HTMLElement;
    fireEvent.keyDown(name, { key: 'p' });
    // startEdit(mealId, mealIndex, entryId, orderIndex, initialQuery)
    expect(startEdit).toHaveBeenCalledWith('m1', 0, 'e1', undefined, 'p');
  });

  it('opens the picker with no seed on Enter (search the current name)', () => {
    const { container, startEdit } = renderLine();
    const name = container.querySelector('[role="button"]') as HTMLElement;
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(startEdit).toHaveBeenCalledWith('m1', 0, 'e1', undefined, undefined);
  });
});

describe('FoodLine muted quantity-0 line (B-107)', () => {
  it('marks a quantity-0 line muted (.zero) and a qty>0 line not', () => {
    const zero = renderLine({
      ...entry(),
      served_quantity: 0,
      consumed: { grams: 0, quantity: 0, kcal: 0, fat: 0, carb: 0, protein: 0 },
    });
    expect(zero.container.querySelector(`.${styles.zero}`)).not.toBeNull();
    cleanup();
    const filled = renderLine(entry());
    expect(filled.container.querySelector(`.${styles.zero}`)).toBeNull();
  });
});

describe('FoodLine empty "+ Aliment" line (B-105)', () => {
  it('is a keyboard tab stop and type-to-search adds a food on its row', () => {
    const { container, startEdit } = renderLine(null);
    const name = container.querySelector('[role="button"]') as HTMLElement;
    expect(name.getAttribute('tabindex')).toBe('0'); // not skipped by Tab
    expect(container.querySelectorAll('button')).toHaveLength(0); // no pin/delete on an empty line

    fireEvent.keyDown(name, { key: 'p' });
    // startEdit(mealId, mealIndex, entryId=null (add), orderIndex=row, initialQuery)
    expect(startEdit).toHaveBeenCalledWith('m1', 0, null, 0, 'p');
  });
});
