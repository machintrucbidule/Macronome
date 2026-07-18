import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MealEntry } from '@macronome/shared';
import '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import type { LineDnd } from '../../hooks/useLineDnd';
import type { TouchReorder } from '../../hooks/useTouchReorder';
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

const touch: TouchReorder = { grabbedId: null, gripHandlers: () => ({}) };

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
    selection: {
      mode: false,
      selected: new Set<string>(),
      isSelected: () => false,
      toggle: vi.fn(),
      selectFromRow: vi.fn(),
    },
  } as unknown as MealsController;
  const utils = render(
    <QueryClientProvider client={qc}>
      <MealsProvider value={ctrl}>
        <FoodLine
          mealId="m1"
          mealIndex={0}
          row={0}
          entry={e}
          editing={false}
          dnd={dnd}
          touch={touch}
        />
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

describe('FoodLine muted quantity-0 line (B-107, pin-conditional B-198)', () => {
  const zeroConsumed = { grams: 0, quantity: 0, kcal: 0, fat: 0, carb: 0, protein: 0 };

  it('mutes a qty-0 GARDE-MANGER (pinned) line only', () => {
    const zeroPinned = renderLine({
      ...entry(),
      served_quantity: 0,
      is_pinned: true,
      consumed: zeroConsumed,
    });
    expect(zeroPinned.container.querySelector(`.${styles.zero}`)).not.toBeNull();
  });

  it('does NOT mute a qty-0 NORMAL (unpinned) line — B-198 refinement', () => {
    const zeroNormal = renderLine({
      ...entry(),
      served_quantity: 0,
      is_pinned: false,
      consumed: zeroConsumed,
    });
    expect(zeroNormal.container.querySelector(`.${styles.zero}`)).toBeNull();
  });

  it('does not mute a qty>0 line', () => {
    const filled = renderLine(entry());
    expect(filled.container.querySelector(`.${styles.zero}`)).toBeNull();
  });
});

describe('FoodLine used-line liseré (B-224)', () => {
  const zeroConsumed = { grams: 0, quantity: 0, kcal: 0, fat: 0, carb: 0, protein: 0 };

  function customEntry(grams: number | null): MealEntry {
    return {
      ...entry(),
      kind: 'custom',
      food_id: null,
      custom_name: 'Plat maison',
      served_quantity: 0,
      served_grams: grams,
    };
  }

  it('adds the liseré to a referenced line with quantity > 0', () => {
    const { container } = renderLine(entry());
    expect(container.querySelector(`.${styles.used}`)).not.toBeNull();
  });

  it('does NOT add the liseré to a pinned qty-0 line (but keeps the pin)', () => {
    const { container } = renderLine({
      ...entry(),
      served_quantity: 0,
      is_pinned: true,
      consumed: zeroConsumed,
    });
    expect(container.querySelector(`.${styles.used}`)).toBeNull();
    // pin + delete buttons still present
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });

  it('does NOT add the liseré to a normal qty-0 line', () => {
    const { container } = renderLine({
      ...entry(),
      served_quantity: 0,
      is_pinned: false,
      consumed: zeroConsumed,
    });
    expect(container.querySelector(`.${styles.used}`)).toBeNull();
  });

  it('adds the liseré to a custom line with served grams > 0', () => {
    const { container } = renderLine(customEntry(150));
    expect(container.querySelector(`.${styles.used}`)).not.toBeNull();
  });

  it('does NOT add the liseré to a custom line with no served grams', () => {
    const { container } = renderLine(customEntry(null));
    expect(container.querySelector(`.${styles.used}`)).toBeNull();
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
