import type { Op } from './op';

// Pure undo/redo stack core (UR-1 / B-133): no React, no async. `record` pushes onto the past
// and clears the redo branch; `undo`/`redo` move the most recent op across the two stacks and
// return it for the async reconciler to apply. Capped so memory stays bounded (≥100 steps kept).

export interface HistoryState {
  past: Op[];
  future: Op[];
}

export const EMPTY_HISTORY: HistoryState = { past: [], future: [] };
export const MAX_HISTORY = 100;

/** Push an op; a new edit invalidates the redo branch. Oldest entries evict past the cap. */
export function record(s: HistoryState, op: Op): HistoryState {
  const past = [...s.past, op];
  if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
  return { past, future: [] };
}

/** Move the most recent past op onto the future; returns it (null when nothing to undo). */
export function undo(s: HistoryState): { state: HistoryState; op: Op | null } {
  if (s.past.length === 0) return { state: s, op: null };
  const op = s.past[s.past.length - 1] as Op;
  return { state: { past: s.past.slice(0, -1), future: [...s.future, op] }, op };
}

/** Move the most recent future op back onto the past; returns it (null when nothing to redo). */
export function redo(s: HistoryState): { state: HistoryState; op: Op | null } {
  if (s.future.length === 0) return { state: s, op: null };
  const op = s.future[s.future.length - 1] as Op;
  return { state: { past: [...s.past, op], future: s.future.slice(0, -1) }, op };
}

export const canUndo = (s: HistoryState): boolean => s.past.length > 0;
export const canRedo = (s: HistoryState): boolean => s.future.length > 0;
