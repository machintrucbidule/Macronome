import type {
  CreateFoodRequest,
  Food,
  FoodListResponse,
  FoodMutationResponse,
  FoodParseLabelRequest,
  FoodParseLabelResponse,
  UpdateFoodRequest,
} from '@macronome/shared';
import { api } from './client';

// Foods resource client (spec/api/foods-recipes.md §Foods). Maps to the API; the
// web reads computed values and never recomputes nutrition figures. The combined
// food∪recipe `/search/loggable` client is deferred to M5 (needs the recipe table).

export interface FoodListParams {
  q?: string;
  min_rating?: 1 | 2 | 3;
  visibility?: 'private' | 'shared';
  source?: 'manual' | 'ciqual' | 'chronodrive';
  include_archived?: boolean;
  sort?: string;
  dir?: 'asc' | 'desc';
  // Keyset pagination (LL-1/B-122): the list lazy-loads page by page.
  cursor?: string;
  limit?: number;
}

function toQueryString(params: FoodListParams): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const foodsApi = {
  list: (params: FoodListParams = {}) =>
    api.get<FoodListResponse>(`/foods${toQueryString(params)}`),
  get: (id: string) => api.get<{ data: Food }>(`/foods/${id}`),
  create: (body: CreateFoodRequest) => api.post<FoodMutationResponse>('/foods', body),
  update: (id: string, body: UpdateFoodRequest) =>
    api.patch<FoodMutationResponse>(`/foods/${id}`, body),
  archive: (id: string) => api.post<{ ok: true }>(`/foods/${id}/archive`),
  restore: (id: string) => api.post<{ ok: true }>(`/foods/${id}/restore`),
  // PM-1/B-114: deduce per-100 g macros from a pasted nutrition label (stateless).
  parseLabel: (body: FoodParseLabelRequest) =>
    api.post<FoodParseLabelResponse>('/foods/parse-label', body),
};
