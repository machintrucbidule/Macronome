import { useMemo, useState } from 'react';
import type { DayDetail } from '@macronome/shared';
import { EMPTY_SUM, selectionSum, type SelectionSum } from '../logic/selectionSum';

// Ephemeral selection state for the Repas Σ readout (B-207), desktop-only. Holds a selection mode
// flag + a global cross-meal Set<entry_id>; the sum is derived (pure) from the day's server-computed
// consumed values — no persistence, no nutrition computation (the reduce is a plain addition).
export interface MealSelection {
  mode: boolean;
  selected: Set<string>;
  sum: SelectionSum;
  /** Enter selection mode (keeps any current selection — normally empty). */
  enter: () => void;
  /** Leave selection mode AND clear the selection. */
  exit: () => void;
  /** Toggle the Σ mode from the controls-bar button. */
  toggleMode: () => void;
  /** Toggle a single line by id (adds/removes from the set). */
  toggle: (id: string) => void;
  /** Toggle a whole meal: if every id is already selected → remove them all, else add them all. */
  toggleMeal: (ids: string[]) => void;
  /** Row / footer click: on Ctrl/⌘-click enter the mode first, then toggle. */
  selectFromRow: (id: string, additive: boolean) => void;
  isSelected: (id: string) => boolean;
  /** True when `ids` is non-empty and every id is selected (a fully-selected meal). */
  allSelected: (ids: string[]) => boolean;
}

function withToggled(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function useMealSelection(day: DayDetail | undefined): MealSelection {
  const [mode, setMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const sum = useMemo(
    () => (day ? selectionSum(day.meals, selected) : { ...EMPTY_SUM }),
    [day, selected],
  );

  const enter = (): void => setMode(true);
  const exit = (): void => {
    setMode(false);
    setSelected(new Set());
  };
  const toggle = (id: string): void => setSelected((prev) => withToggled(prev, id));

  const toggleMeal = (ids: string[]): void =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = ids.length > 0 && ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allIn) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  return {
    mode,
    selected,
    sum,
    enter,
    exit,
    toggleMode: () => (mode ? exit() : enter()),
    toggle,
    toggleMeal,
    selectFromRow: (id, additive) => {
      if (additive && !mode) setMode(true);
      toggle(id);
    },
    isSelected: (id) => selected.has(id),
    allSelected: (ids) => ids.length > 0 && ids.every((id) => selected.has(id)),
  };
}
