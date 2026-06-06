import type {
  CreateRecipeRequest,
  RecipeFull,
  RecipeListResponse,
  RecipeMutationResponse,
  RecipePreviewRequest,
  RecipePreviewResponse,
  UpdateRecipeRequest,
} from '@macronome/shared';
import { api } from './client';

// Recipes resource client (spec/api/foods-recipes.md §Recipes). The web reads computed
// derived values (per-100 g, per-portion, per-line macros) from the API and never
// recomputes them (CLAUDE.md rule 2).

export interface RecipeListParams {
  q?: string;
  include_archived?: boolean;
  sort?: string;
  dir?: 'asc' | 'desc';
}

function toQueryString(params: RecipeListParams): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const recipesApi = {
  list: (params: RecipeListParams = {}) =>
    api.get<RecipeListResponse>(`/recipes${toQueryString(params)}`),
  get: (id: string) => api.get<{ data: RecipeFull }>(`/recipes/${id}`),
  preview: (body: RecipePreviewRequest) =>
    api.post<RecipePreviewResponse>('/recipes/preview', body),
  create: (body: CreateRecipeRequest) => api.post<RecipeMutationResponse>('/recipes', body),
  update: (id: string, body: UpdateRecipeRequest) =>
    api.patch<RecipeMutationResponse>(`/recipes/${id}`, body),
  archive: (id: string) => api.post<{ ok: true }>(`/recipes/${id}/archive`),
  restore: (id: string) => api.post<{ ok: true }>(`/recipes/${id}/restore`),
};
