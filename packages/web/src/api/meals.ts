import type {
  ClearMealRequest,
  CreateMealRequest,
  DayDetail,
  PatchMealRequest,
} from '@macronome/shared';
import { api } from './client';

// Meals sub-resource client (spec/api/days-meals-leftover.md §Meals). A meal is this
// day's own ordered slot; mutations return a slim summary and the page refetches the day.
export interface MealSummary {
  id: string;
  slot_name: string;
  order_index: number;
}

export const mealsApi = {
  create: (date: string, body: CreateMealRequest) =>
    api.post<MealSummary>(`/days/${date}/meals`, body),
  patch: (date: string, mealId: string, body: PatchMealRequest) =>
    api.patch<MealSummary>(`/days/${date}/meals/${mealId}`, body),
  remove: (date: string, mealId: string) => api.del<void>(`/days/${date}/meals/${mealId}`),
  // Replace one meal with the matching meal of `from` (CP-2 / B-248). Returns the whole day,
  // like the day-level copy, so one round-trip refreshes totals, verdict and constat.
  copyFrom: (mealId: string, from: string) =>
    api.post<DayDetail>(`/meals/${mealId}/copy-from`, { from }),
  // Empty one meal (`delete`) or zero its quantities (`zero`) — MC-1/B-296. Returns the whole
  // day, same reason as the copy above.
  clear: (mealId: string, mode: ClearMealRequest['mode']) =>
    api.post<DayDetail>(`/meals/${mealId}/clear`, { mode }),
};
