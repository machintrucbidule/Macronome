import type { PatchSettingsRequest, Settings } from '@macronome/shared';
import { api } from './client';

// Settings resource client (spec/api §Settings). The web reads the stored blob and writes
// partial patches; locale/theme/current_mode are applied client-side from the response.

export const settingsApi = {
  get: () => api.get<{ data: Settings }>('/settings'),
  patch: (body: PatchSettingsRequest) => api.patch<{ data: Settings }>('/settings', body),
  /** Connection proof: lists the configured provider's models (spec/api §GET /settings/ai/models). */
  fetchAiModels: () => api.get<{ data: { id: string }[] }>('/settings/ai/models'),
};
