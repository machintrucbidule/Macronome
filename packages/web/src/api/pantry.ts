import type { CreatePantryRequest, PantryItem, UpdatePantryRequest } from '@macronome/shared';
import { api } from './client';

// Garde-manger resource client (spec/api §Settings). The Paramètres view of pantry_item;
// the Repas 📌 toggle (same data) lives on the meals client. Editing affects future-day
// prefill only. `update` changes a pin's prefill unit (GM-2/B-094).

export const pantryApi = {
  list: (mealSlotName?: string) =>
    api.get<{ data: PantryItem[] }>(
      `/pantry${mealSlotName ? `?meal_slot_name=${encodeURIComponent(mealSlotName)}` : ''}`,
    ),
  create: (body: CreatePantryRequest) => api.post<{ data: PantryItem }>('/pantry', body),
  update: (id: string, body: UpdatePantryRequest) =>
    api.patch<{ data: PantryItem }>(`/pantry/${id}`, body),
  remove: (id: string) => api.del<void>(`/pantry/${id}`),
};
