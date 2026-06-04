import type { CreateMealRequest, PatchMealRequest } from '@macronome/shared';
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
};
