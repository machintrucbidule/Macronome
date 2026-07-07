import { describe, expect, test, vi } from 'vitest';
import type {
  MealEntry,
  NamedPortion,
  PantryItem,
  UpdateMealEntryRequest,
} from '@macronome/shared';
import { resolveEntryDefaultUnit } from './mealActions';
import { moveLineActions, pickActions } from './lineActions';
import type { MealActionDeps, Run } from './mealActions';

// Default unit when adding an item to a meal (B-109): pin prefill → first portion → g.

const pin = (over: Partial<PantryItem>): PantryItem => ({
  id: 'pin-1',
  meal_slot_name: 'Petit déjeuner',
  food_id: 'food-1',
  unit: 'g',
  portion_id: null,
  order_index: 0,
  ...over,
});

const portion = (id: string, label: string): NamedPortion => ({ id, label, grams: 57 });

describe('resolveEntryDefaultUnit', () => {
  test('a garde-manger pin wins, carrying its stored unit/portion', () => {
    expect(resolveEntryDefaultUnit({ pin: pin({ unit: 'kg' }), portions: [] })).toEqual({
      unit: 'kg',
      portion_id: null,
    });
    expect(
      resolveEntryDefaultUnit({
        pin: pin({ unit: 'portion', portion_id: 'P' }),
        portions: [portion('Q', 'autre')],
      }),
    ).toEqual({ unit: 'portion', portion_id: 'P' });
  });

  test('a pin with a deleted portion (unit=portion, portion_id=null) falls back to g', () => {
    expect(
      resolveEntryDefaultUnit({ pin: pin({ unit: 'portion', portion_id: null }), portions: [] }),
    ).toEqual({ unit: 'g', portion_id: null });
  });

  test('no pin: defaults to the first portion (the picker list is label-asc)', () => {
    expect(
      resolveEntryDefaultUnit({
        pin: undefined,
        portions: [portion('a', 'assiette'), portion('b', 'bol')],
      }),
    ).toEqual({ unit: 'portion', portion_id: 'a' });
  });

  test("a recipe's single auto portion defaults the unit to one part", () => {
    expect(
      resolveEntryDefaultUnit({ pin: undefined, portions: [portion('r', 'portion')] }),
    ).toEqual({ unit: 'portion', portion_id: 'r' });
  });

  test('no pin and no portions → grams', () => {
    expect(resolveEntryDefaultUnit({ pin: undefined, portions: [] })).toEqual({
      unit: 'g',
      portion_id: null,
    });
  });
});

// Repas food-line swap (B-150): re-picking a line's food must re-resolve the unit/portion for the
// NEW food so a stale portion_id from the old food can't reach the server (which would 422 it).

const portionEntry: MealEntry = {
  id: 'entry-1',
  kind: 'referenced',
  food_id: 'old-food',
  custom_name: null,
  served_quantity: 2,
  unit: 'portion',
  portion_id: 'old-portion',
  served_grams: 114,
  snap: { kcal: 0, fat: 0, carb: 0, protein: 0 },
  consumed: { grams: null, quantity: null, kcal: 0, fat: 0, carb: 0, protein: 0 },
  is_pinned: false,
  order_index: 0,
};

function swapDeps(): { deps: MealActionDeps; update: ReturnType<typeof vi.fn> } {
  const update = vi.fn().mockResolvedValue(portionEntry);
  const deps = {
    day: {
      query: { data: { meals: [{ id: 'meal-1', order_index: 0, entries: [portionEntry] }] } },
    },
    pantry: [] as PantryItem[],
    setEditing: vi.fn(),
    setPendingFocus: vi.fn(),
  } as unknown as MealActionDeps;
  // updateEntry.mutateAsync is the only mutation the re-pick path calls.
  (deps.day as unknown as { updateEntry: { mutateAsync: typeof update } }).updateEntry = {
    mutateAsync: update,
  };
  return { deps, update };
}

const run: Run = async (p) => {
  await p;
};
const resolveMealId = vi.fn();

function bodyOf(update: ReturnType<typeof vi.fn>): UpdateMealEntryRequest | undefined {
  const arg = update.mock.calls[0]?.[0] as { body: UpdateMealEntryRequest } | undefined;
  return arg?.body;
}

describe('pickFood — food swap on an existing line (B-150)', () => {
  test('swapping a portion line to a portionless food resets unit→g, portion_id→null', async () => {
    const { deps, update } = swapDeps();
    const actions = pickActions(deps, run, resolveMealId);
    await actions.pickFood(
      { mealId: 'meal-1', mealIndex: 0, entryId: 'entry-1' },
      'new-food',
      [], // the new food has no named portions
    );
    expect(bodyOf(update)).toEqual({ food_id: 'new-food', unit: 'g', portion_id: null });
  });

  test('swapping to a food with portions defaults to its first portion', async () => {
    const { deps, update } = swapDeps();
    const actions = pickActions(deps, run, resolveMealId);
    await actions.pickFood({ mealId: 'meal-1', mealIndex: 0, entryId: 'entry-1' }, 'new-food', [
      portion('p1', 'assiette'),
      portion('p2', 'bol'),
    ]);
    expect(bodyOf(update)).toEqual({ food_id: 'new-food', unit: 'portion', portion_id: 'p1' });
  });
});

// Cross-meal move (B-187/B-188): the action sends the target meal (order_index only for an
// empty-row drop) and records a move op carrying the source row for undo.

function moveDeps() {
  const move = vi.fn().mockResolvedValue({ ...portionEntry, order_index: 7 });
  const record = vi.fn();
  const deps = {
    day: {
      query: { data: { meals: [{ id: 'meal-1', order_index: 0, entries: [portionEntry] }] } },
    },
    recordHistory: record,
  } as unknown as MealActionDeps;
  (deps.day as unknown as { moveEntry: { mutateAsync: typeof move } }).moveEntry = {
    mutateAsync: move,
  };
  return { deps, move, record };
}

describe('moveEntry — cross-meal move (B-187/B-188)', () => {
  test('omits order_index (server appends) and records the move with the source row', async () => {
    const { deps, move, record } = moveDeps();
    const actions = moveLineActions(deps, run);
    await actions.moveEntry('meal-1', 'entry-1', 'meal-2');
    expect(move).toHaveBeenCalledWith({
      mealId: 'meal-1',
      id: 'entry-1',
      body: { target_meal_id: 'meal-2' },
    });
    expect(record).toHaveBeenCalledWith({
      type: 'move',
      mealId: 'meal-1',
      entryId: 'entry-1',
      targetMealId: 'meal-2',
      fromOrderIndex: 0,
      toOrderIndex: 7, // the landing row comes from the server response
    });
  });

  test('passes an explicit order_index (empty-row drop)', async () => {
    const { deps, move } = moveDeps();
    const actions = moveLineActions(deps, run);
    await actions.moveEntry('meal-1', 'entry-1', 'meal-2', 4);
    expect(move).toHaveBeenCalledWith({
      mealId: 'meal-1',
      id: 'entry-1',
      body: { target_meal_id: 'meal-2', order_index: 4 },
    });
  });

  test('no-op on a same-meal target or a scaffold line (no id)', async () => {
    const { deps, move, record } = moveDeps();
    const actions = moveLineActions(deps, run);
    await actions.moveEntry('meal-1', 'entry-1', 'meal-1');
    await actions.moveEntry('meal-1', '', 'meal-2');
    expect(move).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
