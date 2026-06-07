import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PatchProfileRequest } from '@macronome/shared';
import { profileApi } from '../../api/profile';

// Metabolic-profile hooks (sex / birth date / height). The profile is account data, edited on
// the Compte screen (B-060). Saving invalidates both the profile cache and the Cibles engine
// readout, since the engine derives age/figures from the profile server-side.
const PROFILE_KEY = ['profile'] as const;
const TARGET_KEY = ['target'] as const;

export function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: () => profileApi.get() });
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
