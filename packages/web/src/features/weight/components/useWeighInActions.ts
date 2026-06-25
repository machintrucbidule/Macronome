import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CreateWeighInRequest, WeighIn } from '@macronome/shared';
import { ApiError } from '../../../api/client';
import { useSettingsMutation } from '../../settings/useSettings';
import { useWeightMutations, WEIGHT_KEY } from '../useWeight';
import type { WeighInDraft } from './WeighInFields';
import type { WeighInModalTarget } from '../useWeightController';

// Save/replace/delete actions for the weigh-in modal, split out to keep the component small
// (CLAUDE.md modularity). Owns the create/patch/remove + settings mutations and the conflict/
// error state; the component owns only the draft + rendering. Three save paths:
//   - open (B-176): one PATCH /settings { current_mode, open_period_note } — no weigh-in written;
//   - edit: PATCH /weight/:id;
//   - add: POST /weight, then clear the open-period note so it can't leak onto a future interval.
export interface WeighInActions {
  isOpen: boolean;
  initial: WeighIn | null;
  pending: boolean;
  error: string | null;
  conflictId: string | null;
  clearConflict: () => void;
  save: () => Promise<void>;
  saveOpen: () => Promise<void>;
  replace: () => Promise<void>;
  del: () => Promise<void>;
}

export function useWeighInActions(
  target: Exclude<WeighInModalTarget, null>,
  draft: WeighInDraft,
  openNote: string | null | undefined,
  onClose: () => void,
): WeighInActions {
  const isOpen = target.kind === 'open';
  const initial = target.kind === 'edit' ? target.weighIn : null;
  const { create, patch, remove } = useWeightMutations();
  const settings = useSettingsMutation();
  const qc = useQueryClient();
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || patch.isPending || remove.isPending || settings.isPending;

  const values = (): Omit<CreateWeighInRequest, 'date'> => ({
    weight_kg: Number(draft.weight),
    waist_cm: draft.waist === '' ? null : Number(draft.waist),
    diet_flag: draft.flag,
    note: draft.note === '' ? null : draft.note,
  });
  const refreshWeight = (): Promise<void> =>
    qc.invalidateQueries({ queryKey: [WEIGHT_KEY] }).then(() => undefined);

  const saveOpen = async (): Promise<void> => {
    setError(null);
    try {
      const note = draft.note === '' ? null : draft.note;
      await settings.mutateAsync({ current_mode: draft.flag, open_period_note: note });
      await refreshWeight();
      onClose();
    } catch {
      setError('error');
    }
  };

  const save = async (): Promise<void> => {
    setError(null);
    try {
      if (initial) {
        await patch.mutateAsync({ id: initial.id, body: { date: draft.date, ...values() } });
      } else {
        await create.mutateAsync({ date: draft.date, ...values() });
        if (openNote != null) {
          await settings.mutateAsync({ open_period_note: null });
          await refreshWeight();
        }
      }
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'weigh_in_date_occupied')
        setConflictId(e.details?.existing_id ?? null);
      else setError(e instanceof ApiError ? e.code : 'error');
    }
  };

  const replace = async (): Promise<void> => {
    if (conflictId) await patch.mutateAsync({ id: conflictId, body: values() });
    onClose();
  };
  const del = async (): Promise<void> => {
    if (initial) await remove.mutateAsync(initial.id);
    onClose();
  };

  return {
    isOpen,
    initial,
    pending,
    error,
    conflictId,
    clearConflict: () => setConflictId(null),
    save,
    saveOpen,
    replace,
    del,
  };
}
