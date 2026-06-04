import type { LoggableSearchResponse } from '@macronome/shared';
import { api } from './client';

// Combined log search client (spec/api/foods-recipes.md §"Combined log search"). Used by
// the recipe ingredient picker (and, later, the daily-log autocomplete) to search foods
// AND recipe-derived foods in one call.

function toQuery(q: string | undefined): string {
  const sp = new URLSearchParams();
  if (q && q.trim()) sp.set('q', q.trim());
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const loggableSearchApi = {
  search: (q?: string) => api.get<LoggableSearchResponse>(`/search/loggable${toQuery(q)}`),
};
