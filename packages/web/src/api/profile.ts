import type { PatchProfileRequest, Profile } from '@macronome/shared';
import { api } from './client';

// Metabolic-profile client (spec/api/weight-targets-stats-settings.md §"GET/PATCH
// /profile"). Edited on the Compte screen (B-060); feeds the engine (age is derived server-side).

export const profileApi = {
  get: () => api.get<{ data: Profile }>('/profile'),
  patch: (body: PatchProfileRequest) => api.patch<{ data: Profile }>('/profile', body),
};
