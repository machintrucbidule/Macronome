import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Container, LeftoverPreviewLine, Meal, MealEntry } from '@macronome/shared';
import { useContainers } from '../../../containers/useContainers';
import { r0 } from '../../format';
import { useLeftoverPreview } from './useLeftoverPreview';

// Form state + derivations for the leftover modal (kept out of the component so it stays
// presentational). Container default = the locked built-in "Rien" (tare 0); the chosen tare
// drives the net + the block-and-warn guard. Proration is NEVER computed here: the served →
// consumed preview comes from the stateless preview endpoint (CLAUDE.md rule 2). In edit mode
// (`initial`) the saved gross/container/selection are restored; a since-deleted frozen
// container is offered as a synthetic option and kept unless the user picks another.

/** Sentinel container value = "keep the group's frozen container" (used on re-edit when the
 *  original container no longer exists in the catalog). */
const FROZEN = '__frozen__';

export interface LeftoverInitial {
  groupId: string;
  gross: string;
  entryIds: string[];
  containerName: string;
  tareG: number;
}

export interface LeftoverForm {
  fieldId: string;
  containerOptions: { value: string; label: string }[];
  eligible: MealEntry[];
  selected: Set<string>;
  toggle: (id: string, on: boolean) => void;
  gross: string;
  setGross: (v: string) => void;
  selectedId: string | null;
  setContainerId: (id: string) => void;
  net: number;
  grossNum: number;
  servedTotal: number;
  blocked: boolean;
  warning: string | null;
  previewLines: LeftoverPreviewLine[];
  /** What to send as PATCH/POST container_id: a real id, null ("Rien"), or undefined =
   *  keep the group's frozen container (re-edit of a since-deleted container). */
  containerIdForSave: string | null | undefined;
}

/** Resolve the chosen container to its tare. FROZEN → the group's frozen tare; otherwise the
 *  built-in "Rien" by default, or the picked container's empty weight. */
function resolveTare(
  containers: Container[],
  containerId: string | null,
  initial?: LeftoverInitial,
): { selectedId: string | null; tare: number } {
  if (containerId === FROZEN && initial) return { selectedId: FROZEN, tare: initial.tareG };
  const builtin = containers.find((c) => c.is_builtin) ?? containers[0] ?? null;
  const selectedId = containerId ?? builtin?.id ?? null;
  const tare = containers.find((c) => c.id === selectedId)?.empty_weight_g ?? 0;
  return { selectedId, tare };
}

/** Initial container selection for edit mode: match the frozen container to a current one by
 *  name + tare; fall back to the FROZEN sentinel when it was since deleted/edited. */
function initialContainerId(containers: Container[], initial?: LeftoverInitial): string | null {
  if (!initial) return null;
  const match = containers.find(
    (c) => c.name === initial.containerName && c.empty_weight_g === initial.tareG,
  );
  return match?.id ?? FROZEN;
}

/** Container <select> options: the catalog, plus the group's frozen container as a synthetic
 *  option when it was since deleted (so it can stay selected on re-edit). */
function buildOptions(
  containers: Container[],
  selectedId: string | null,
  initial?: LeftoverInitial,
): { value: string; label: string }[] {
  const options = containers.map((c) => ({
    value: c.id,
    label: `${c.name} (${r0(c.empty_weight_g)} g)`,
  }));
  if (selectedId === FROZEN && initial) {
    options.unshift({ value: FROZEN, label: `${initial.containerName} (${r0(initial.tareG)} g)` });
  }
  return options;
}

/** Block-and-warn guard (mirrors the server): block when nothing selected, no gross weight,
 *  gross < tare (net negative), or the net exceeds the selected served total. */
function guard(
  selectionSize: number,
  grossNum: number,
  tare: number,
  net: number,
  servedTotal: number,
  t: (k: string) => string,
): { blocked: boolean; warning: string | null } {
  const belowTare = grossNum < tare;
  const exceedsServed = net > servedTotal;
  const blocked = selectionSize === 0 || grossNum <= 0 || belowTare || exceedsServed;
  const warning = belowTare
    ? t('meals.leftover.warnBelowTare')
    : exceedsServed
      ? t('meals.leftover.warnExceeds')
      : null;
  return { blocked, warning };
}

export function useLeftoverForm(meal: Meal, initial?: LeftoverInitial): LeftoverForm {
  const { t } = useTranslation();
  const fieldId = useId();
  const { data: containersData } = useContainers();
  const containers = containersData?.data ?? [];
  const eligible = useMemo(
    () => meal.entries.filter((e) => (e.served_grams ?? 0) > 0),
    [meal.entries],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial ? initial.entryIds : eligible.map((e) => e.id)),
  );
  const [gross, setGross] = useState(initial?.gross ?? '');
  const [containerId, setContainerId] = useState<string | null>(() =>
    initialContainerId(containers, initial),
  );

  const { selectedId, tare } = resolveTare(containers, containerId, initial);
  const grossNum = Number(gross.replace(',', '.')) || 0;
  const net = grossNum - tare;
  const servedTotal = eligible
    .filter((e) => selected.has(e.id))
    .reduce((sum, e) => sum + (e.served_grams ?? 0), 0);
  const { blocked, warning } = guard(selected.size, grossNum, tare, net, servedTotal, t);

  // Live preview body: only once a selection + a positive gross weight exist.
  const previewBody =
    selected.size > 0 && grossNum > 0
      ? { entry_ids: [...selected], gross_grams: grossNum, tare_g: tare }
      : null;
  const preview = useLeftoverPreview(meal.id, previewBody);
  const containerOptions = buildOptions(containers, selectedId, initial);

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
    containerOptions,
    eligible,
    selected,
    toggle,
    gross,
    setGross,
    selectedId,
    setContainerId,
    net,
    grossNum,
    servedTotal,
    blocked,
    warning,
    previewLines: preview.data?.lines ?? [],
    containerIdForSave: selectedId === FROZEN ? undefined : selectedId,
  };
}
