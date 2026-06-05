import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Container, Meal, MealEntry } from '@macronome/shared';
import { useContainers } from '../../../containers/useContainers';

// Form state + derivations for the leftover modal (kept out of the component so it stays
// presentational). Container default = the locked built-in "Rien" (tare 0); the chosen tare
// drives the net preview and the block-and-warn guard. No proration here (server-derived).
export interface LeftoverForm {
  fieldId: string;
  containers: Container[];
  eligible: MealEntry[];
  selected: Set<string>;
  toggle: (id: string, on: boolean) => void;
  gross: string;
  setGross: (v: string) => void;
  selectedId: string | null;
  setContainerId: (id: string) => void;
  net: number;
  servedTotal: number;
  blocked: boolean;
  warning: string | null;
}

/** Default-and-resolve the chosen container: built-in "Rien" by default; returns its id +
 * tare (the server resolves the id and freezes the value). */
function pickContainer(
  containers: Container[],
  containerId: string | null,
): { selectedId: string | null; tare: number } {
  const builtin = containers.find((c) => c.is_builtin) ?? containers[0] ?? null;
  const selectedId = containerId ?? builtin?.id ?? null;
  const tare = containers.find((c) => c.id === selectedId)?.empty_weight_g ?? 0;
  return { selectedId, tare };
}

export function useLeftoverForm(meal: Meal): LeftoverForm {
  const { t } = useTranslation();
  const fieldId = useId();
  const { data: containersData } = useContainers();
  const containers = containersData?.data ?? [];
  const eligible = useMemo(
    () => meal.entries.filter((e) => (e.served_grams ?? 0) > 0),
    [meal.entries],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(eligible.map((e) => e.id)));
  const [gross, setGross] = useState('');
  const [containerId, setContainerId] = useState<string | null>(null);

  const { selectedId, tare } = pickContainer(containers, containerId);
  const grossNum = Number(gross.replace(',', '.')) || 0;
  const net = grossNum - tare;
  const servedTotal = eligible
    .filter((e) => selected.has(e.id))
    .reduce((sum, e) => sum + (e.served_grams ?? 0), 0);
  const exceedsServed = net > servedTotal;
  const blocked = selected.size === 0 || grossNum <= 0 || grossNum < tare || exceedsServed;
  const warning =
    grossNum < tare
      ? t('meals.leftover.warnBelowTare')
      : exceedsServed
        ? t('meals.leftover.warnExceeds')
        : null;

  const toggle = (id: string, on: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return {
    fieldId,
    containers,
    eligible,
    selected,
    toggle,
    gross,
    setGross,
    selectedId,
    setContainerId,
    net,
    servedTotal,
    blocked,
    warning,
  };
}
