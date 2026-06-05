import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/auth';

// First-run probe (M8): whether the install still needs its owner account. Non-enumerating
// (a boolean only). Drives AppGate's redirect to the setup wizard.
export const SETUP_STATE_KEY = ['setup-state'] as const;

export function useSetupState() {
  return useQuery({
    queryKey: SETUP_STATE_KEY,
    queryFn: () => authApi.setupState(),
    retry: false,
    staleTime: 60_000,
  });
}
