import type { FoodRefGroupsResponse, FoodRefListResponse } from '@macronome/shared';
import { api } from './client';

// Ciqual reference-catalog client (spec/api/foods-recipes.md §Food reference catalog, B-292).
// Read-only: adoption goes through `foodsApi.create` with `source:'ciqual'`, not through here.

export interface FoodRefListParams {
  /** Matches the French AND English names at once (D6). */
  q?: string;
  group?: string;
  /** Drives the name sort and the `already_owned` probe — send the UI language. */
  locale?: 'fr' | 'en';
  sort?: string;
  dir?: 'asc' | 'desc';
  cursor?: string;
  /** Row index the page starts at — the jump path (LD-1/B-303). Excludes `cursor`. */
  offset?: number;
  limit?: number;
}

function toQueryString(params: FoodRefListParams): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const foodRefsApi = {
  list: (params: FoodRefListParams = {}) =>
    api.get<FoodRefListResponse>(`/food-refs${toQueryString(params)}`),
  groups: (locale: 'fr' | 'en') =>
    api.get<FoodRefGroupsResponse>(`/food-refs/groups?locale=${locale}`),
};
