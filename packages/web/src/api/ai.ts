import type { DishPhotoMacrosRequest, DishPhotoMacrosResponse } from '@macronome/shared';
import { api } from './client';

// AI *use* client (spec/api/ai.md, B-118). Posts dish photos (data URLs) + an optional note to
// the configured vision model; the response pre-fills the Repas custom-entry form. Persists nothing.
export const aiApi = {
  dishPhotoMacros: (body: DishPhotoMacrosRequest) =>
    api.post<DishPhotoMacrosResponse>('/ai/dish-photo-macros', body),
};
