import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DayDetail } from '@macronome/shared';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import type { LineSheetTarget } from '../../hooks/mealActions';
import { LineEditorSheet } from './LineEditorSheet';

// Mobile "move to meal" dropdown (B-188): lists the day's meals with the line's current
// meal pre-selected; picking another meal closes the sheet and moves the line. Absent on a
// scaffold pre-fill line (no persisted id — nothing to move, like pin/delete).
vi.mock('../../hooks/useFoodLookup', () => ({
  useFood: () => ({ data: { data: { name: 'Riz' } } }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const entry = (id: string) => ({
  id,
  kind: 'referenced' as const,
  food_id: 'food-1',
  custom_name: null,
  served_quantity: 100,
  unit: 'g' as const,
  portion_id: null,
  served_grams: 100,
  snap: { kcal: 130, fat: 0, carb: 28, protein: 2 },
  consumed: { grams: 100, quantity: 100, kcal: 130, fat: 0, carb: 28, protein: 2 },
  is_pinned: false,
  order_index: 0,
});

const DAY = {
  meals: [
    { id: 'm1', slot_name: 'Déjeuner', order_index: 0, entries: [entry('e1')] },
    { id: 'm2', slot_name: 'Dîner', order_index: 1, entries: [] },
  ],
} as unknown as DayDetail;

function renderSheet(target: LineSheetTarget, day: DayDetail = DAY) {
  const moveEntry = vi.fn().mockResolvedValue(undefined);
  const closeLineSheet = vi.fn();
  const ctrl = {
    day,
    actions: {
      moveEntry,
      closeLineSheet,
      setQty: vi.fn(),
      setUnit: vi.fn(),
      togglePin: vi.fn(),
      deleteEntry: vi.fn(),
      openCustom: vi.fn(),
      startEdit: vi.fn(),
    },
  } as unknown as MealsController;
  render(
    <MealsProvider value={ctrl}>
      <LineEditorSheet target={target} />
    </MealsProvider>,
  );
  return { moveEntry, closeLineSheet, setQty: ctrl.actions.setQty };
}

const label = (): string => i18n.t('meals.lineSheet.moveToMeal');

describe('LineEditorSheet — move to meal (B-188)', () => {
  it('lists the day’s meals with the current one selected; picking another moves and closes', () => {
    const target = { mealId: 'm1', mealIndex: 0, entryId: 'e1', orderIndex: 0 };
    const { moveEntry, closeLineSheet } = renderSheet(target);

    const trigger = screen.getByRole('button', { name: label() });
    expect(trigger.textContent).toContain('Déjeuner'); // current meal pre-selected
    fireEvent.click(trigger);

    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Déjeuner', 'Dîner']);
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('option', { name: 'Dîner' }));
    expect(closeLineSheet).toHaveBeenCalled();
    expect(moveEntry).toHaveBeenCalledWith('m1', 'e1', 'm2'); // no order_index → server appends
  });

  it('re-picking the current meal neither moves nor closes', () => {
    const target = { mealId: 'm1', mealIndex: 0, entryId: 'e1', orderIndex: 0 };
    const { moveEntry, closeLineSheet } = renderSheet(target);
    fireEvent.click(screen.getByRole('button', { name: label() }));
    fireEvent.click(screen.getByRole('option', { name: 'Déjeuner' }));
    expect(moveEntry).not.toHaveBeenCalled();
    expect(closeLineSheet).not.toHaveBeenCalled();
  });

  it('is absent on a scaffold pre-fill line (no persisted id)', () => {
    const scaffoldDay = {
      meals: [
        { id: 'm1', slot_name: 'Déjeuner', order_index: 0, entries: [entry('')] },
        { id: 'm2', slot_name: 'Dîner', order_index: 1, entries: [] },
      ],
    } as unknown as DayDetail;
    const ctrl = {
      day: scaffoldDay,
      actions: {
        closeLineSheet: vi.fn(),
        setQty: vi.fn(),
        openCustom: vi.fn(),
        startEdit: vi.fn(),
      },
    } as unknown as MealsController;
    render(
      <MealsProvider value={ctrl}>
        <LineEditorSheet target={{ mealId: 'm1', mealIndex: 0, entryId: '', orderIndex: 0 }} />
      </MealsProvider>,
    );
    expect(screen.queryByRole('button', { name: label() })).toBeNull();
  });
});

// B-249 — "Remettre à zéro" in the sheet: the mobile twin of the context-menu entry. Zeroes the
// quantity while keeping the line; disabled (not hidden) when already 0, so the rows below stay put.
describe('LineEditorSheet — remettre à zéro (B-249)', () => {
  const zeroLabel = (): string => i18n.t('meals.lineSheet.zeroQty');
  const target = { mealId: 'm1', mealIndex: 0, entryId: 'e1', orderIndex: 0 };

  const dayWithQty = (qty: number): DayDetail =>
    ({
      meals: [
        {
          id: 'm1',
          slot_name: 'Déjeuner',
          order_index: 0,
          entries: [{ ...entry('e1'), served_quantity: qty }],
        },
        { id: 'm2', slot_name: 'Dîner', order_index: 1, entries: [] },
      ],
    }) as unknown as DayDetail;

  it('zeroes the quantity, keeping the line’s unit and portion', () => {
    const { setQty } = renderSheet(target, dayWithQty(100));
    fireEvent.click(screen.getByRole('button', { name: zeroLabel() }));
    expect(setQty).toHaveBeenCalledWith(
      'm1',
      0,
      expect.objectContaining({ id: 'e1' }),
      0,
      'g',
      null,
    );
  });

  it('is present but disabled when the line is already at 0', () => {
    const { setQty } = renderSheet(target, dayWithQty(0));
    const button = screen.getByRole('button', { name: zeroLabel() });
    expect(button).toHaveProperty('disabled', true);
    fireEvent.click(button);
    expect(setQty).not.toHaveBeenCalled();
  });
});
