import { useState } from 'react';
import type { Meal, PatchLeftoverRequest } from '@macronome/shared';
import { ApiError } from '../../../../api/client';
import { useMeals } from '../../MealsContext';
import type { LeftoverForm } from './useLeftoverForm';
import type { LeftoverInitial } from './useLeftoverForm';

// Apply/remove handlers for the leftover form (split out to keep the component presentational
// and within the line cap). Create → POST; edit → PATCH the group (omitting container_id keeps
// a since-deleted frozen container); remove → DELETE. A failed call surfaces the error code.
export interface LeftoverSubmit {
  apply: () => Promise<void>;
  remove: () => Promise<void>;
  serverError: string | null;
  pending: boolean;
}

export function useLeftoverSubmit(
  meal: Meal,
  form: LeftoverForm,
  onDone: () => void,
  initial?: LeftoverInitial,
): LeftoverSubmit {
  const { mutations } = useMeals();
  const [serverError, setServerError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>): Promise<void> => {
    setServerError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setServerError(e instanceof ApiError ? e.code : 'request_failed');
    }
  };

  const apply = (): Promise<void> => {
    const entryIds = [...form.selected];
    if (initial) {
      const body: PatchLeftoverRequest = { gross_grams: form.grossNum, entry_ids: entryIds };
      if (form.containerIdForSave !== undefined) body.container_id = form.containerIdForSave;
      return run(() => mutations.updateLeftover.mutateAsync({ groupId: initial.groupId, body }));
    }
    return run(() =>
      mutations.createLeftover.mutateAsync({
        mealId: meal.id,
        body: {
          container_id: form.containerIdForSave ?? null,
          gross_grams: form.grossNum,
          entry_ids: entryIds,
        },
      }),
    );
  };

  const remove = (): Promise<void> =>
    initial ? run(() => mutations.removeLeftover.mutateAsync(initial.groupId)) : Promise.resolve();

  const pending =
    mutations.createLeftover.isPending ||
    mutations.updateLeftover.isPending ||
    mutations.removeLeftover.isPending;

  return { apply, remove, serverError, pending };
}
