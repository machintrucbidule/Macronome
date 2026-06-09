import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PatchSettingsRequest } from '@macronome/shared';
import { settingsApi } from '../../api/settings';

// Settings data hooks (spec/api §Settings). The query is shared with the app-load sync
// (same key) so a patch refreshes both the Paramètres controls and the live theme/locale.
export const SETTINGS_KEY = ['settings'] as const;

export function useSettingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => settingsApi.get(),
    retry: false,
    enabled: options?.enabled ?? true,
  });
}

export function useSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchSettingsRequest) => settingsApi.patch(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

/**
 * On-demand fetch of the configured provider's model list (the AI connection proof). A GET
 * triggered by a button click, wrapped in a mutation for the idle/loading/success/error states.
 */
export function useAiModelsMutation() {
  return useMutation({
    mutationFn: () => settingsApi.fetchAiModels(),
  });
}
