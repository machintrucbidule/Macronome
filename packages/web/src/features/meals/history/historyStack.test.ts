import { expect, test } from 'vitest';
import { EMPTY_HISTORY, MAX_HISTORY, canRedo, canUndo, record, redo, undo } from './historyStack';
import type { Op } from './op';

// UR-1 / B-133 — the pure undo/redo stack core (no React, no server).
const op = (id: string): Op => ({
  type: 'update',
  mealId: 'm',
  entryId: id,
  before: {},
  after: {},
});

test('record pushes onto past, returns a new state, leaves the input untouched', () => {
  const before = EMPTY_HISTORY;
  const after = record(before, op('a'));
  expect(after.past.map((o) => (o as { entryId: string }).entryId)).toEqual(['a']);
  expect(before.past).toEqual([]); // input not mutated
});

test('record clears the redo branch (a new edit discards redo)', () => {
  let s = record(EMPTY_HISTORY, op('a'));
  s = undo(s).state; // a → future
  expect(canRedo(s)).toBe(true);
  s = record(s, op('b')); // a new edit
  expect(canRedo(s)).toBe(false);
  expect(s.future).toEqual([]);
});

test('the past is capped at MAX_HISTORY, evicting the oldest', () => {
  let s = EMPTY_HISTORY;
  for (let i = 0; i < MAX_HISTORY + 5; i++) s = record(s, op(`e${i}`));
  expect(s.past).toHaveLength(MAX_HISTORY);
  const first = (s.past[0] as { entryId: string }).entryId;
  const last = (s.past[s.past.length - 1] as { entryId: string }).entryId;
  expect(first).toBe('e5'); // e0..e4 evicted
  expect(last).toBe(`e${MAX_HISTORY + 4}`);
});

test('undo moves the most recent op to future and returns it; empty → null', () => {
  const s = record(EMPTY_HISTORY, op('a'));
  const r = undo(s);
  expect((r.op as { entryId: string }).entryId).toBe('a');
  expect(canUndo(r.state)).toBe(false);
  expect(canRedo(r.state)).toBe(true);
  expect(undo(EMPTY_HISTORY)).toEqual({ state: EMPTY_HISTORY, op: null });
});

test('redo moves the most recent future op back to past; empty → null', () => {
  let s = record(EMPTY_HISTORY, op('a'));
  s = undo(s).state;
  const r = redo(s);
  expect((r.op as { entryId: string }).entryId).toBe('a');
  expect(canUndo(r.state)).toBe(true);
  expect(canRedo(r.state)).toBe(false);
  expect(redo(EMPTY_HISTORY)).toEqual({ state: EMPTY_HISTORY, op: null });
});

test('record → undo → redo returns to the post-record state', () => {
  const recorded = record(EMPTY_HISTORY, op('a'));
  const round = redo(undo(recorded).state).state;
  expect(round).toEqual(recorded);
});
