import { useState } from 'react';
import type { WeighIn, WeightRange } from '@macronome/shared';

// UI state for the Poids screen (kept out of the data hook). The chart range, the waist
// overlay toggle, and the entry/edit modal target live here. The screen-local current mode
// (Régime/Maintien) lives in its own `useWeightMode` hook, which also persists it (M7).
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
}

export function useWeightController(): WeightController {
  const [range, setRange] = useState<WeightRange>('all');
  const [showWaist, setShowWaist] = useState(false);
  const [modal, setModal] = useState<WeighInModalTarget>(null);

  return {
    range,
    setRange,
    showWaist,
    toggleWaist: () => setShowWaist((v) => !v),
    modal,
    openAdd: () => setModal({ kind: 'add' }),
    openEdit: (weighIn) => setModal({ kind: 'edit', weighIn }),
    closeModal: () => setModal(null),
  };
}
