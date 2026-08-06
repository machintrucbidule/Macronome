import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Meal } from '@macronome/shared';
import i18n from '../../../../i18n/config';
import { MealsProvider } from '../../MealsContext';
import type { MealsController } from '../../hooks/useMealsController';
import { MealColumn } from './MealColumn';
import { MealMenuSheet } from './MealMenuSheet';

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

const clearMealLines = vi.fn();
const zeroMealLines = vi.fn();

function renderColumn(deleteMeal = vi.fn(), meal: Meal = MEAL, copyMealYesterday = vi.fn()) {
  clearMealLines.mockClear();
  zeroMealLines.mockClear();
  const ctrl = {
    editing: null,
    mutations: {},
    actions: {
      deleteMeal,
      copyMealYesterday,
      clearMealLines,
      zeroMealLines,
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
      <MealColumn meal={meal} index={0} meals={[meal]} width={300} />
    </MealsProvider>,
  );
  return { ...utils, deleteMeal, copyMealYesterday };
}

/** A meal holding one served line (content the copy would overwrite). */
const FILLED = {
  ...MEAL,
  entries: [{ id: 'e1', served_quantity: 120, order_index: 0 }],
} as unknown as Meal;

/** A meal holding only a qty-0 garde-manger placeholder — not content. */
const PREFILLED = {
  ...MEAL,
  entries: [{ id: '', served_quantity: 0, order_index: 0 }],
} as unknown as Meal;

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

// CP-2 / B-248: the header carries a "Copier le repas de la veille" button, and the confirm is
// shown ONLY when the meal has something to lose (design/components/modals.md §Conditional
// confirmation) — an empty meal, the common case, copies in one click.
describe('MealColumn copy yesterday (B-248)', () => {
  const action = (): string => i18n.t('meals.copyMeal.action');

  it('copies straight away when the meal is empty (no confirm)', () => {
    const { copyMealYesterday } = renderColumn(vi.fn(), MEAL);
    fireEvent.click(screen.getByRole('button', { name: action() }));
    expect(screen.queryByText(i18n.t('meals.copyMeal.title'))).toBeNull();
    expect(copyMealYesterday).toHaveBeenCalledWith('m1', 0);
  });

  it('treats a qty-0 garde-manger placeholder as empty too', () => {
    const { copyMealYesterday } = renderColumn(vi.fn(), PREFILLED);
    fireEvent.click(screen.getByRole('button', { name: action() }));
    expect(copyMealYesterday).toHaveBeenCalledTimes(1);
  });

  it('confirms first when the meal has a served line, and copies only on confirm', () => {
    const { copyMealYesterday } = renderColumn(vi.fn(), FILLED);
    fireEvent.click(screen.getByRole('button', { name: action() }));
    expect(screen.getByText(i18n.t('meals.copyMeal.title'))).toBeTruthy();
    expect(copyMealYesterday).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('meals.copyMeal.confirm') }));
    expect(copyMealYesterday).toHaveBeenCalledWith('m1', 0);
  });

  it('cancelling the confirm copies nothing', () => {
    const { copyMealYesterday } = renderColumn(vi.fn(), FILLED);
    fireEvent.click(screen.getByRole('button', { name: action() }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(screen.queryByText(i18n.t('meals.copyMeal.title'))).toBeNull();
    expect(copyMealYesterday).not.toHaveBeenCalled();
  });

  it('offers the same action as a text row in the mobile ⋯ sheet', () => {
    // The header button is CSS-hidden ≤560px, so the sheet is the phone's only entry point.
    // jsdom reports desktop, so the sheet is rendered directly rather than through the header.
    const onCopyYesterday = vi.fn();
    render(
      <MealMenuSheet
        name="Déjeuner"
        canMoveLeft={false}
        canMoveRight={false}
        canClearLines
        canZeroLines
        onCopyYesterday={onCopyYesterday}
        onClearLines={vi.fn()}
        onZeroLines={vi.fn()}
        onRename={vi.fn()}
        onMoveLeft={vi.fn()}
        onMoveRight={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: action() }));
    expect(onCopyYesterday).toHaveBeenCalledTimes(1);
  });
});

// MC-1 / B-296: the ⋯ menu gained two bulk actions. They are the only destructive flow in the app
// with NO confirmation dialog (owner decision) — the toast's Annuler is the safety net — and they
// are disabled, not hidden, when they would change nothing.
describe('MealColumn bulk actions (B-296)', () => {
  const clearLabel = (): string => i18n.t('meals.meal.clearLines');
  const zeroLabel = (): string => i18n.t('meals.meal.zeroLines');
  const openMenu = (): void => {
    fireEvent.click(screen.getByText('⋯'));
  };
  const entry = (name: string): HTMLButtonElement => screen.getByRole('button', { name });

  /** A meal holding only a garde-manger placeholder at 0 — a delete would keep it exactly as is. */
  const PINNED_ZERO = {
    ...MEAL,
    entries: [{ id: 'e1', served_quantity: 0, order_index: 0, is_pinned: true }],
  } as unknown as Meal;

  it('applies immediately, with no confirmation dialog', () => {
    renderColumn(vi.fn(), FILLED);
    openMenu();
    fireEvent.click(entry(clearLabel()));

    expect(clearMealLines).toHaveBeenCalledWith('m1', 0);
    // Nothing to confirm: neither the meal-delete modal nor the copy one may appear.
    expect(screen.queryByText(i18n.t('meals.meal.deleteTitle'))).toBeNull();
    expect(screen.queryByText(i18n.t('meals.copyMeal.title'))).toBeNull();
  });

  it('sends the zero action from its own entry', () => {
    renderColumn(vi.fn(), FILLED);
    openMenu();
    fireEvent.click(entry(zeroLabel()));
    expect(zeroMealLines).toHaveBeenCalledWith('m1', 0);
    expect(clearMealLines).not.toHaveBeenCalled();
  });

  it('disables both entries on an empty meal', () => {
    renderColumn(vi.fn(), MEAL);
    openMenu();
    expect(entry(clearLabel()).disabled).toBe(true);
    expect(entry(zeroLabel()).disabled).toBe(true);
  });

  it('disables both on a meal holding only a garde-manger line already at 0', () => {
    // Deleting keeps that line at 0 (D1) and zeroing leaves it at 0 — both would write nothing.
    renderColumn(vi.fn(), PINNED_ZERO);
    openMenu();
    expect(entry(clearLabel()).disabled).toBe(true);
    expect(entry(zeroLabel()).disabled).toBe(true);
  });
});

describe('MealColumn bulk actions — menu order (B-296)', () => {
  const clearLabel = (): string => i18n.t('meals.meal.clearLines');
  const zeroLabel = (): string => i18n.t('meals.meal.zeroLines');

  it('orders the desktop menu: bulk · moves · rename/delete', () => {
    renderColumn(vi.fn(), FILLED);
    fireEvent.click(screen.getByText('⋯'));
    const menu = screen.getByRole('menu');
    const labels = [...menu.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toEqual([
      clearLabel(),
      zeroLabel(),
      i18n.t('meals.meal.moveLeft'),
      i18n.t('meals.meal.moveRight'),
      i18n.t('meals.meal.rename'),
      i18n.t('meals.meal.delete'),
    ]);
  });

  it('orders the mobile sheet with the copy first, then the two bulk entries (D3)', () => {
    const { container } = render(
      <MealMenuSheet
        name="Déjeuner"
        canMoveLeft={false}
        canMoveRight={false}
        canClearLines
        canZeroLines
        onCopyYesterday={vi.fn()}
        onClearLines={vi.fn()}
        onZeroLines={vi.fn()}
        onRename={vi.fn()}
        onMoveLeft={vi.fn()}
        onMoveRight={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const labels = [...container.ownerDocument.querySelectorAll('[role="dialog"] button')]
      .map((b) => b.textContent)
      .filter((l) => l !== '');
    expect(labels.slice(0, 3)).toEqual([
      i18n.t('meals.copyMeal.action'),
      clearLabel(),
      zeroLabel(),
    ]);
    expect(labels.slice(-2)).toEqual([i18n.t('meals.meal.rename'), i18n.t('meals.meal.delete')]);
  });
});
