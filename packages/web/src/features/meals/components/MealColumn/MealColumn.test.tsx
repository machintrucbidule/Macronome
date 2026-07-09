import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Meal } from '@macronome/shared';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { MealColumn } from './MealColumn';

// B-074: deleting a meal must open the shared styled confirm modal, not a native window.confirm
// (design/components/modals.md). The heavy line children are stubbed — only the header → modal
// → deleteMeal wiring is under test.
vi.mock('../FoodLine/FoodLine', () => ({ FoodLine: () => null }));
vi.mock('./LineHeader', () => ({ LineHeader: () => null }));
vi.mock('./MealFooter', () => ({ MealFooter: () => null }));
vi.mock('../../hooks/useLineDnd', () => ({
  useLineDnd: () => ({ dragId: null, onDragStart: vi.fn(), onDragEnd: vi.fn(), onDrop: vi.fn() }),
}));
// The mobile one-tap photo entry (QP-1/B-158) reads the settings query + AI mutation; stub it as
// not-ready so this delete-flow test needs no QueryClient (parity with the other stubbed hooks).
vi.mock('../../hooks/useMealPhotoEntry', () => ({
  useMealPhotoEntry: () => ({
    ready: false,
    busy: false,
    message: null,
    trigger: vi.fn(),
    dismiss: vi.fn(),
    inputRef: { current: null },
    inputProps: {},
  }),
}));

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('fr');
  vi.restoreAllMocks();
});

const MEAL = {
  id: 'm1',
  slot_name: 'Déjeuner',
  order_index: 0,
  entries: [],
  leftover_groups: [],
  totals: {},
} as unknown as Meal;

function renderColumn(deleteMeal = vi.fn()) {
  const ctrl = {
    editing: null,
    mutations: {},
    actions: {
      deleteMeal,
      openCook: vi.fn(),
      renameMeal: vi.fn(),
      reorderEntries: vi.fn(),
    },
    selection: {
      mode: false,
      selected: new Set<string>(),
      isSelected: () => false,
      allSelected: () => false,
      toggle: vi.fn(),
      toggleMeal: vi.fn(),
      selectFromRow: vi.fn(),
      enter: vi.fn(),
    },
  } as unknown as MealsController;
  const utils = render(
    <MealsProvider value={ctrl}>
      <MealColumn meal={MEAL} index={0} meals={[MEAL]} width={300} />
    </MealsProvider>,
  );
  return { ...utils, deleteMeal };
}

describe('MealColumn delete (B-074)', () => {
  it('opens the styled modal — not window.confirm — and deletes on confirm', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { deleteMeal } = renderColumn();

    // Open the ⋯ menu, then click "Supprimer le repas".
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByText(i18n.t('meals.meal.delete')));

    // Styled modal is shown; the native confirm was never used.
    expect(screen.getByText(i18n.t('meals.meal.deleteTitle'))).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deleteMeal).not.toHaveBeenCalled();

    // Confirming triggers the deletion.
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.remove') }));
    expect(deleteMeal).toHaveBeenCalledWith('m1');
  });

  it('cancelling the modal does not delete', () => {
    const { deleteMeal } = renderColumn();
    fireEvent.click(screen.getByText('⋯'));
    fireEvent.click(screen.getByText(i18n.t('meals.meal.delete')));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(screen.queryByText(i18n.t('meals.meal.deleteTitle'))).toBeNull();
    expect(deleteMeal).not.toHaveBeenCalled();
  });
});
