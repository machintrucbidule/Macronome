import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTargetRequest,
  SuggestTargetRequest,
  PatchProfileRequest,
} from '@macronome/shared';
import { targetApi } from '../../api/target';
import { profileApi } from '../../api/profile';

// Data hooks for the Cibles screen. The engine readout (GET /target) is the source of
// truth for every derived tile + warning; saving a target or patching the profile
// invalidates it so the server-computed figures refresh (web never computes them).
const TARGET_KEY = ['target'] as const;
const PROFILE_KEY = ['profile'] as const;

export function useTarget() {
  return useQuery({ queryKey: TARGET_KEY, queryFn: () => targetApi.get() });
}

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => profileApi.get() });
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

export function useProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchProfileRequest) => profileApi.patch(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROFILE_KEY });
      void qc.invalidateQueries({ queryKey: TARGET_KEY }); // profile feeds the engine
    },
  });
}
