import { expect, test } from 'vitest';
import { reconcileRedo, reconcileUndo } from './opReconcile';
import { CREATED, type LineSnapshot, type Op } from './op';

// UR-1 / B-133 — pure per-op undo/redo → mutation intents, with injected resolve + exists.
const ident = (id: string): string => id;
const remap =
  (m: Record<string, string>) =>
  (id: string): string =>
    m[id] ?? id;
const yes = (): boolean => true;
const no = (): boolean => false;

const snap = (over: Partial<LineSnapshot> = {}): LineSnapshot => ({
  kind: 'referenced',
  food_id: 'food-1',
  custom_name: null,
  served_quantity: 100,
  unit: 'g',
  portion_id: null,
  snap: { kcal: 0, fat: 0, carb: 0, protein: 0 },
  order_index: 2,
  ...over,
});

test('add: undo removes the line, redo re-creates it (binding the remap)', () => {
  const op: Op = { type: 'add', mealId: 'm', entryId: 'e1', snapshot: snap() };
  expect(reconcileUndo(op, ident, yes)).toEqual([{ kind: 'remove', mealId: 'm', id: 'e1' }]);
  const redo = reconcileRedo(op, ident);
  expect(redo[0]).toMatchObject({ kind: 'create', mealId: 'm', bindRemapFor: 'e1' });
});

test('remove: undo re-creates from the snapshot (custom keeps snap + order_index), redo removes', () => {
  const op: Op = {
    type: 'remove',
    mealId: 'm',
    entryId: 'e1',
    snapshot: snap({ kind: 'custom', food_id: null, custom_name: 'Café', order_index: 3 }),
  };
  const undo = reconcileUndo(op, ident, yes);
  expect(undo[0]).toMatchObject({ kind: 'create', bindRemapFor: 'e1' });
  const body = (undo[0] as { body: Record<string, unknown> }).body;
  expect(body).toMatchObject({ kind: 'custom', custom_name: 'Café', order_index: 3 });
  expect(body.snap).toBeDefined();
  expect(reconcileRedo(op, ident)).toEqual([{ kind: 'remove', mealId: 'm', id: 'e1' }]);
});

test('update: undo applies before, redo applies after; ids are resolved', () => {
  const op: Op = {
    type: 'update',
    mealId: 'm',
    entryId: 'old',
    before: { served_quantity: 10, unit: 'g' },
    after: { served_quantity: 250, unit: 'g' },
  };
  const r = remap({ old: 'new' });
  expect(reconcileUndo(op, r, yes)).toEqual([
    { kind: 'update', mealId: 'm', id: 'new', body: { served_quantity: 10, unit: 'g' } },
  ]);
  expect(reconcileRedo(op, r)).toEqual([
    { kind: 'update', mealId: 'm', id: 'new', body: { served_quantity: 250, unit: 'g' } },
  ]);
});

test('move: undo returns the line to its source row, redo re-applies the target; ids resolved', () => {
  const op: Op = {
    type: 'move',
    mealId: 'src',
    entryId: 'old',
    targetMealId: 'tgt',
    fromOrderIndex: 2,
    toOrderIndex: 5,
  };
  const r = remap({ old: 'new' });
  expect(reconcileUndo(op, r, yes)).toEqual([
    { kind: 'move', mealId: 'tgt', id: 'new', targetMealId: 'src', orderIndex: 2 },
  ]);
  expect(reconcileRedo(op, r)).toEqual([
    { kind: 'move', mealId: 'src', id: 'new', targetMealId: 'tgt', orderIndex: 5 },
  ]);
});

test('reorder: undo restores the before map, redo the after map; ids resolved', () => {
  const op: Op = {
    type: 'reorder',
    mealId: 'm',
    before: [{ id: 'a', order_index: 0 }],
    after: [{ id: 'a', order_index: 1 }],
  };
  const r = remap({ a: 'A' });
  expect(reconcileUndo(op, r, yes)).toEqual([
    { kind: 'reorder', mealId: 'm', order: [{ id: 'A', order_index: 0 }] },
  ]);
  expect(reconcileRedo(op, r)).toEqual([
    { kind: 'reorder', mealId: 'm', order: [{ id: 'A', order_index: 1 }] },
  ]);
});

test('pin (recorded pin): undo unpins, redo pins', () => {
  const op: Op = { type: 'pin', mealId: 'm', entryId: 'e1', pinnedBefore: false, snapshot: snap() };
  expect(reconcileUndo(op, ident, yes)).toEqual([{ kind: 'unpin', mealId: 'm', id: 'e1' }]);
  expect(reconcileRedo(op, ident)).toEqual([{ kind: 'pin', mealId: 'm', id: 'e1' }]);
});

test('unpin (recorded unpin), line survived: undo re-pins it', () => {
  const op: Op = { type: 'pin', mealId: 'm', entryId: 'e1', pinnedBefore: true, snapshot: snap() };
  expect(reconcileUndo(op, ident, yes)).toEqual([{ kind: 'pin', mealId: 'm', id: 'e1' }]);
  expect(reconcileRedo(op, ident)).toEqual([{ kind: 'unpin', mealId: 'm', id: 'e1' }]);
});

test('unpin (recorded unpin), qty-0 line removed: undo re-creates then pins the new line', () => {
  const op: Op = { type: 'pin', mealId: 'm', entryId: 'e1', pinnedBefore: true, snapshot: snap() };
  const undo = reconcileUndo(op, ident, no);
  expect(undo).toHaveLength(2);
  expect(undo[0]).toMatchObject({ kind: 'create', bindRemapFor: 'e1' });
  expect(undo[1]).toEqual({ kind: 'pin', mealId: 'm', id: CREATED });
});
