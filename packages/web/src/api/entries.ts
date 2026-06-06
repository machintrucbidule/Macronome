import type {
  CreateMealEntryRequest,
  MealEntry,
  ReorderEntriesRequest,
  UpdateMealEntryRequest,
} from '@macronome/shared';
import { api } from './client';

// Meal entries client (spec/api/days-meals-leftover.md §Meal entries). Entries hang off
// /meals/:mealId. The server freezes the macro snapshot at write time and derives
// `consumed`; the page refetches the day after a mutation to read the recomputed totals.
export const entriesApi = {
  create: (mealId: string, body: CreateMealEntryRequest) =>
    api.post<MealEntry>(`/meals/${mealId}/entries`, body),
  update: (mealId: string, id: string, body: UpdateMealEntryRequest) =>
    api.patch<MealEntry>(`/meals/${mealId}/entries/${id}`, body),
  reorder: (mealId: string, body: ReorderEntriesRequest) =>
    api.patch<void>(`/meals/${mealId}/entries/order`, body),
  remove: (mealId: string, id: string) => api.del<void>(`/meals/${mealId}/entries/${id}`),
  pin: (mealId: string, id: string) => api.post<MealEntry>(`/meals/${mealId}/entries/${id}/pin`),
  unpin: (mealId: string, id: string) =>
    api.post<MealEntry>(`/meals/${mealId}/entries/${id}/unpin`),
};
