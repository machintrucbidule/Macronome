import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTargetRequest,
  PatchTargetRequest,
  PreviewTargetRequest,
  RecomputeTargetRequest,
  SuggestTargetRequest,
} from '@macronome/shared';
import { targetApi } from '../../api/target';
import { draftToPreviewBody, isSavable, type TargetDraft } from './draft';

// Data hooks for the Cibles screen. The engine readout (GET /target) is the source of
// truth for every derived tile + warning; saving a target invalidates it so the
// server-computed figures refresh (web never computes them). The metabolic profile is
// account data now — its hooks live in features/account/useProfile (B-060).
const TARGET_KEY = ['target'] as const;
const TARGET_HISTORY_KEY = ['targetHistory'] as const;

export function useTarget() {
  return useQuery({ queryKey: TARGET_KEY, queryFn: () => targetApi.get() });
}

/** The full list of target versions (TH-1) — the "Historique des cibles" panel. */
export function useTargetHistory() {
  return useQuery({ queryKey: TARGET_HISTORY_KEY, queryFn: () => targetApi.list() });
}

/**
 * Live engine readout for the manual-targets draft (B-042). The web never computes a
 * figure (CLAUDE.md rule 2): it posts the unsaved draft (debounced) to the stateless
 * preview endpoint and renders what comes back. Disabled until the draft is savable; the
 * previous readout is kept while a recompute is in flight.
 */
export function useTargetPreview(draft: TargetDraft, includeAsOf: boolean) {
  const key = JSON.stringify(draftToPreviewBody(draft, includeAsOf));
  const [debouncedKey, setDebouncedKey] = useState(key);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedKey(key), 300);
    return () => clearTimeout(id);
  }, [key]);
  const body = useMemo(() => JSON.parse(debouncedKey) as PreviewTargetRequest, [debouncedKey]);
  return useQuery({
    queryKey: ['targetPreview', debouncedKey],
    queryFn: () => targetApi.preview(body),
    enabled: isSavable(draft),
    placeholderData: (prev) => prev,
  });
}

export function useTargetMutations() {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: CreateTargetRequest) => targetApi.create(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TARGET_KEY });
      void qc.invalidateQueries({ queryKey: TARGET_HISTORY_KEY });
    },
  });
  const suggest = useMutation({
    mutationFn: (body: SuggestTargetRequest) => targetApi.suggest(body),
  });
  return { save, suggest };
}

/** Per-version edit/delete/recompute (TH-1). Editing a version can change today's live
 * snapshot and a recompute rewrites past days' verdicts, so every mutation invalidates
 * all caches (the readout, the history list, and the day/journal/stats views). */
export function useTargetVersionMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => qc.invalidateQueries();
  const patch = useMutation({
    mutationFn: (vars: { id: string; body: PatchTargetRequest }) =>
      targetApi.patch(vars.id, vars.body),
    onSuccess: invalidateAll,
  });
  const remove = useMutation({
    mutationFn: (id: string) => targetApi.remove(id),
    onSuccess: invalidateAll,
  });
  const recompute = useMutation({
    mutationFn: (vars: { id: string; body?: RecomputeTargetRequest }) =>
      targetApi.recompute(vars.id, vars.body ?? {}),
    onSuccess: invalidateAll,
  });
  return { patch, remove, recompute };
}

/** The count of logged days a version's recompute would touch (button label). Fetched
 * only while a past version is being edited. */
export function useRecomputeCount(id: string | null) {
  return useQuery({
    queryKey: ['recomputeCount', id],
    queryFn: () => targetApi.recomputeCount(id as string),
    enabled: id !== null,
  });
}
