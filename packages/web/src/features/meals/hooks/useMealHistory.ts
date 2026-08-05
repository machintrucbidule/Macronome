import { useCallback, useEffect, useRef, useState } from 'react';
import type { DayDetail } from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { createIdMap } from '../history/idMap';
import { CREATED, type Intent, type Op } from '../history/op';
import { reconcileRedo, reconcileUndo } from '../history/opReconcile';
import {
  EMPTY_HISTORY,
  canRedo as stackCanRedo,
  canUndo as stackCanUndo,
  record as stackRecord,
  redo as stackRedo,
  undo as stackUndo,
} from '../history/historyStack';
import type { UseDay } from './useDay';

// Async undo/redo controller for the Repas screen (UR-1 / B-133): holds the pure history stack +
// the id-map, and executes an op's reconciled intents through the existing useDay mutations (no
// new endpoints; the refetch-on-success reconciles the view). Advances the stack only on success;
// a failed step surfaces the existing error banner and leaves the stack put. Reset on date change.
export interface MealHistory {
  record: (op: Op) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Drop the stack: its entry ids no longer designate anything. Called after a server-side day
   *  restore (B-261) — the replay re-creates every line with fresh ids. */
  reset: () => void;
}

export function useMealHistory(
  day: UseDay,
  date: string,
  setError: (code: string | null) => void,
): MealHistory {
  const [state, setState] = useState(EMPTY_HISTORY);
  const idMap = useRef(createIdMap()).current;
  const busy = useRef(false);

  // Drop the stack: its entry ids no longer designate anything. On a date change, and after a
  // server-side day restore (B-261), whose replay re-creates every line with fresh ids.
  const reset = useCallback(() => {
    setState(EMPTY_HISTORY);
    idMap.clear();
  }, [idMap]);

  useEffect(() => reset(), [date, reset]);

  const data = day.query.data as DayDetail | undefined;
  const exists = useCallback(
    (id: string): boolean => Boolean(data?.meals.some((m) => m.entries.some((e) => e.id === id))),
    [data],
  );

  const exec = useCallback(
    async (intents: Intent[]): Promise<void> => {
      let created: string | null = null;
      for (const it of intents) {
        if (it.kind === 'create') {
          const e = await day.createEntry.mutateAsync({ mealId: it.mealId, body: it.body });
          idMap.remap(it.bindRemapFor, e.id);
          created = e.id;
          continue;
        }
        if (it.kind === 'reorder') {
          await day.reorderEntries.mutateAsync({ mealId: it.mealId, body: { order: it.order } });
          continue;
        }
        const id = it.id === CREATED && created ? created : it.id;
        if (it.kind === 'update')
          await day.updateEntry.mutateAsync({ mealId: it.mealId, id, body: it.body });
        else if (it.kind === 'move')
          await day.moveEntry.mutateAsync({
            mealId: it.mealId,
            id,
            body: { target_meal_id: it.targetMealId, order_index: it.orderIndex },
          });
        else if (it.kind === 'remove') await day.removeEntry.mutateAsync({ mealId: it.mealId, id });
        else if (it.kind === 'pin') await day.pinEntry.mutateAsync({ mealId: it.mealId, id });
        else await day.unpinEntry.mutateAsync({ mealId: it.mealId, id });
      }
    },
    [day, idMap],
  );

  const step = useCallback(
    async (dir: 'undo' | 'redo'): Promise<void> => {
      if (busy.current) return;
      const move = dir === 'undo' ? stackUndo(state) : stackRedo(state);
      if (!move.op) return;
      busy.current = true;
      try {
        const intents =
          dir === 'undo'
            ? reconcileUndo(move.op, idMap.resolve, exists)
            : reconcileRedo(move.op, idMap.resolve);
        await exec(intents);
        setState(move.state);
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.code : 'request_failed');
      } finally {
        busy.current = false;
      }
    },
    [state, idMap, exists, exec, setError],
  );

  return {
    record: useCallback((op: Op) => setState((s) => stackRecord(s, op)), []),
    undo: useCallback(() => void step('undo'), [step]),
    redo: useCallback(() => void step('redo'), [step]),
    canUndo: stackCanUndo(state),
    canRedo: stackCanRedo(state),
    reset,
  };
}
