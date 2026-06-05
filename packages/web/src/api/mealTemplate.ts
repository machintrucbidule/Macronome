import type {
  CreateMealTemplateRequest,
  MealTemplateItem,
  PatchMealTemplateRequest,
} from '@macronome/shared';
import { api } from './client';

// Meal-template resource client (spec/api §Settings). The ordered default day structure
// edited in Paramètres; seeds new days server-side.

export const mealTemplateApi = {
  list: () => api.get<{ data: MealTemplateItem[] }>('/meal-template'),
  create: (body: CreateMealTemplateRequest) =>
    api.post<{ data: MealTemplateItem }>('/meal-template', body),
  update: (id: string, body: PatchMealTemplateRequest) =>
    api.patch<{ data: MealTemplateItem }>(`/meal-template/${id}`, body),
  remove: (id: string) => api.del<void>(`/meal-template/${id}`),
};
