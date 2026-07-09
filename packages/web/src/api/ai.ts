import type {
  AdviceListResponse,
  AdviceResponse,
  DishPhotoMacrosRequest,
  DishPhotoMacrosResponse,
  MealSuggestionsRequest,
  MealSuggestionsResponse,
} from '@macronome/shared';
import { api } from './client';

// AI *use* client (spec/api/ai.md). Posts dish photos (data URLs) + an optional note to the
// configured vision model (dishPhotoMacros, B-118); requests meal proposals that bring the day
// into its targets (mealSuggestions, B-123). Advice (Conseils, B-202) is the one that PERSISTS:
// generate archives the reply, list reads the archive, remove deletes one. The first two persist
// nothing — their response pre-fills / applies through the normal Repas flow.
export const aiApi = {
  dishPhotoMacros: (body: DishPhotoMacrosRequest) =>
    api.post<DishPhotoMacrosResponse>('/ai/dish-photo-macros', body),
  mealSuggestions: (body: MealSuggestionsRequest) =>
    api.post<MealSuggestionsResponse>('/ai/meal-suggestions', body),
  generateAdvice: () => api.post<AdviceResponse>('/ai/advice', {}),
  listAdvice: () => api.get<AdviceListResponse>('/ai/advice'),
  deleteAdvice: (id: string) => api.del<void>(`/ai/advice/${id}`),
};
