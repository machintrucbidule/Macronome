import type {
  BulkIdsResponse,
  BulkUndoResponse,
  BulkUpdateResponse,
  CreateRecipeRequest,
  RecipeBulkUpdateRequest,
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
  min_rating?: 1 | 2 | 3;
  include_archived?: boolean;
  sort?: string;
  dir?: 'asc' | 'desc';
  // Keyset pagination (LL-1/B-122): the list lazy-loads page by page.
  cursor?: string;
  /** Row index the page starts at — the jump path (LD-1/B-303). Excludes `cursor`. */
  offset?: number;
  limit?: number;
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
  // Bulk edit (BE-1/B-308) — rating only; see the twin block in `api/foods.ts`.
  ids: (params: RecipeListParams = {}) =>
    api.get<BulkIdsResponse>(`/recipes/ids${toQueryString(params)}`),
  bulkUpdate: (body: RecipeBulkUpdateRequest) =>
    api.patch<BulkUpdateResponse>('/recipes/bulk', body),
  bulkUndo: () => api.post<BulkUndoResponse>('/recipes/bulk/undo'),
};
