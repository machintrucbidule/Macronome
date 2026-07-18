import { useState } from 'react';
import type { Period, WeighIn, WeightRange } from '@macronome/shared';

// UI state for the Poids screen (kept out of the data hook). The chart range, the waist
// overlay toggle, and the entry/edit modal target live here. The screen-local current mode
// (Régime/Maintien) lives in its own `useWeightMode` hook, which also persists it (M7).
export type WeighInModalTarget =
  | { kind: 'add' }
  | { kind: 'edit'; weighIn: WeighIn }
  | { kind: 'open' } // the open interval (B-176): a reduced note + régime editor, no weigh-in
  | null;

/** The interval-days recap popup target (B-225): the clicked period's inclusive [start,end], plus
 *  its end weight + Δ (B-227) so the popup header can show the interval's weight change — both null
 *  on the open interval (no closing weight). */
export interface RecapTarget {
  start: string;
  end: string;
  weightEnd: number | null;
  delta: number | null;
}

export interface WeightController {
  range: WeightRange;
  setRange: (r: WeightRange) => void;
  showWaist: boolean;
  toggleWaist: () => void;
  modal: WeighInModalTarget;
  openAdd: () => void;
  openEdit: (weighIn: WeighIn) => void;
  openOpenPeriod: () => void;
  closeModal: () => void;
  recap: RecapTarget | null;
  openRecap: (period: Period) => void;
  closeRecap: () => void;
}

export function useWeightController(): WeightController {
  const [range, setRange] = useState<WeightRange>('all');
  const [showWaist, setShowWaist] = useState(false);
  const [modal, setModal] = useState<WeighInModalTarget>(null);
  const [recap, setRecap] = useState<RecapTarget | null>(null);

  return {
    range,
    setRange,
    showWaist,
    toggleWaist: () => setShowWaist((v) => !v),
    modal,
    openAdd: () => setModal({ kind: 'add' }),
    openEdit: (weighIn) => setModal({ kind: 'edit', weighIn }),
    openOpenPeriod: () => setModal({ kind: 'open' }),
    closeModal: () => setModal(null),
    recap,
    openRecap: (period) =>
      setRecap({
        start: period.start_date,
        end: period.end_date,
        weightEnd: period.weight_end,
        delta: period.delta,
      }),
    closeRecap: () => setRecap(null),
  };
}
