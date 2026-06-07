import { useState } from 'react';
import type { DayDetail } from '@macronome/shared';
import { usePantry } from '../../settings/usePantry';
import { useDay } from './useDay';
import { createMealActions, type CustomTarget, type EditTarget } from './mealActions';

// Screen controller for Repas: the day query + UI state (editing line, open modal, pending qty
// focus, the load/save error banner). Actions live in mealActions.ts. Components read this
// through MealsContext (no prop-drilling). It renders server-computed figures; never computes.
export type { CustomTarget, CustomValues, EditTarget } from './mealActions';

export function useMealsController(date: string) {
  const day = useDay(date);
  // Pantry pins (shared ['pantry'] query) drive the default-unit-on-add precedence (B-109).
  const pantry = usePantry();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [customTarget, setCustomTarget] = useState<CustomTarget | null>(null);
  const [leftoverMealId, setLeftoverMealId] = useState<string | null>(null);
  const [cookMealId, setCookMealId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = createMealActions({
    day,
    pantry: pantry.data?.data ?? [],
    date,
    setEditing,
    setCustomTarget,
    setLeftoverMealId,
    setCookMealId,
    setPendingFocus,
    setError,
  });

  return {
    date,
    day: day.query.data as DayDetail | undefined,
    isLoading: day.query.isLoading,
    isError: day.query.isError,
    mutations: day,
    editing,
    customTarget,
    leftoverMealId,
    cookMealId,
    pendingFocus,
    error,
    actions,
  };
}

export type MealsController = ReturnType<typeof useMealsController>;
