import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTargetRequest,
  PreviewTargetRequest,
  SuggestTargetRequest,
} from '@macronome/shared';
import { targetApi } from '../../api/target';
import { draftToPreviewBody, isSavable, type TargetDraft } from './draft';

// Data hooks for the Cibles screen. The engine readout (GET /target) is the source of
// truth for every derived tile + warning; saving a target invalidates it so the
// server-computed figures refresh (web never computes them). The metabolic profile is
// account data now — its hooks live in features/account/useProfile (B-060).
const TARGET_KEY = ['target'] as const;

export function useTarget() {
  return useQuery({ queryKey: TARGET_KEY, queryFn: () => targetApi.get() });
}

/**
 * Live engine readout for the manual-targets draft (B-042). The web never computes a
 * figure (CLAUDE.md rule 2): it posts the unsaved draft (debounced) to the stateless
 * preview endpoint and renders what comes back. Disabled until the draft is savable; the
 * previous readout is kept while a recompute is in flight.
 */
export function useTargetPreview(draft: TargetDraft) {
  const key = JSON.stringify(draftToPreviewBody(draft));
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
    onSuccess: () => qc.invalidateQueries({ queryKey: TARGET_KEY }),
  });
  const suggest = useMutation({
    mutationFn: (body: SuggestTargetRequest) => targetApi.suggest(body),
  });
  return { save, suggest };
}
