import { useRef, useState } from 'react';
import type { DayDetail } from '@macronome/shared';
import { usePantry } from '../../settings/usePantry';
import { useDay } from './useDay';
import { useMealHistory } from './useMealHistory';
import { useMealSelection } from './useMealSelection';
import {
  createMealActions,
  type CustomTarget,
  type EditTarget,
  type LineSheetTarget,
} from './mealActions';

// Screen controller for Repas: the day query + UI state (editing line, open modal, pending qty
// focus, the load/save error banner). Actions live in mealActions.ts. Components read this
// through MealsContext (no prop-drilling). It renders server-computed figures; never computes.
export type { CustomTarget, CustomValues, EditTarget, LineSheetTarget } from './mealActions';

export function useMealsController(date: string) {
  const day = useDay(date);
  // Pantry pins (shared ['pantry'] query) drive the default-unit-on-add precedence (B-109).
  const pantry = usePantry();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [customTarget, setCustomTarget] = useState<CustomTarget | null>(null);
  const [lineSheetTarget, setLineSheetTarget] = useState<LineSheetTarget | null>(null);
  const [leftoverMealId, setLeftoverMealId] = useState<string | null>(null);
  const [cookMealId, setCookMealId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Day-level drag source (B-187): lets a drop in ANOTHER meal's column know which line is
  // being dragged (each column's DnD hook is per-meal). A ref, not state — no re-renders.
  const lineDragRef = useRef<{ entryId: string; mealId: string } | null>(null);
  // Line-level undo/redo (UR-1 / B-133): records edits and replays inverses through useDay.
  const history = useMealHistory(day, date, setError);
  // Desktop-only selection-sum (B-207): ephemeral cross-meal selection + derived Σ readout.
  const selection = useMealSelection(day.query.data);

  const actions = createMealActions({
    day,
    pantry: pantry.data?.data ?? [],
    date,
    setEditing,
    setCustomTarget,
    setLineSheetTarget,
    setLeftoverMealId,
    setCookMealId,
    setPendingFocus,
    setError,
    recordHistory: history.record,
  });

  return {
    date,
    day: day.query.data as DayDetail | undefined,
    isLoading: day.query.isLoading,
    isError: day.query.isError,
    mutations: day,
    editing,
    customTarget,
    lineSheetTarget,
    leftoverMealId,
    cookMealId,
    pendingFocus,
    error,
    lineDragRef,
    actions,
    selection,
    undo: history.undo,
    redo: history.redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}

export type MealsController = ReturnType<typeof useMealsController>;
