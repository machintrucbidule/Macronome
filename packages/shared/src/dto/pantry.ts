import { z } from 'zod';

// Pantry (garde-manger) DTOs (spec/api §Settings "GET/POST/DELETE /pantry",
// spec/schema/tables-logging.md → pantry_item). Recurring foods pre-filled at quantity 0
// on every new day's matching meal slot. The same pantry_item is toggled by the Repas 📌
// (POST /meals/:id/entries/:id/pin · /unpin) and edited here from Paramètres. Adding a
// duplicate (user, meal_slot_name, food_id) → 409 pantry_duplicate.

export const PantryListQuerySchema = z.object({
  meal_slot_name: z.string().min(1).optional(),
});
export type PantryListQuery = z.infer<typeof PantryListQuerySchema>;

export const CreatePantrySchema = z.object({
  meal_slot_name: z.string().min(1).max(200),
  food_id: z.string().uuid(),
});
export type CreatePantryRequest = z.infer<typeof CreatePantrySchema>;

/** A stored pantry pin as returned by the API (ordered by insertion). */
export interface PantryItem {
  id: string;
  meal_slot_name: string;
  food_id: string;
  order_index: number;
}
