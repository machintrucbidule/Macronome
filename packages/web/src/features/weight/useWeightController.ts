import { useState } from 'react';
import type { DietFlag, WeighIn, WeightRange } from '@macronome/shared';

// UI state for the Poids screen (kept out of the data hook). The chart range, the waist
// overlay toggle, the entry/edit modal target, and the screen-local current mode
// (Régime/Maintien) all live here. The mode is ephemeral in M4 (persistence → M7): it is
// seeded from the server's `current_mode` and pre-selects a new weigh-in's diet flag +
// gates the projection display locally.
export type WeighInModalTarget = { kind: 'add' } | { kind: 'edit'; weighIn: WeighIn } | null;

export interface WeightController {
  range: WeightRange;
  setRange: (r: WeightRange) => void;
  showWaist: boolean;
  toggleWaist: () => void;
  modal: WeighInModalTarget;
  openAdd: () => void;
  openEdit: (weighIn: WeighIn) => void;
  closeModal: () => void;
  mode: DietFlag | null;
  setMode: (m: DietFlag) => void;
}

export function useWeightController(): WeightController {
  const [range, setRange] = useState<WeightRange>('all');
  const [showWaist, setShowWaist] = useState(false);
  const [modal, setModal] = useState<WeighInModalTarget>(null);
  const [mode, setMode] = useState<DietFlag | null>(null);

  return {
    range,
    setRange,
    showWaist,
    toggleWaist: () => setShowWaist((v) => !v),
    modal,
    openAdd: () => setModal({ kind: 'add' }),
    openEdit: (weighIn) => setModal({ kind: 'edit', weighIn }),
    closeModal: () => setModal(null),
    mode,
    setMode,
  };
}
