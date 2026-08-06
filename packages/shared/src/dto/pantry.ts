import { z } from 'zod';
import { EntryUnitSchema, type EntryUnit } from './day.js';

// Pantry (garde-manger) DTOs (spec/api §Settings "GET/POST/PATCH/DELETE /pantry",
// spec/schema/tables-logging.md → pantry_item). Recurring foods pre-filled at quantity 0
// on every new day's matching meal slot. The same pantry_item is toggled by the Repas 📌
// (POST /meals/:id/entries/:id/pin · /unpin) and edited here from Paramètres. Adding a
// duplicate (user, meal_slot_name, food_id) → 409 pantry_duplicate. Each pin carries a
// prefill unit (GM-2/B-092): the unit a new day's qty-0 line is created with (g by default,
// or a named portion via portion_id).

export const PantryListQuerySchema = z.object({
  meal_slot_name: z.string().min(1).optional(),
});
export type PantryListQuery = z.infer<typeof PantryListQuerySchema>;

export const CreatePantrySchema = z.object({
  meal_slot_name: z.string().min(1).max(200),
  food_id: z.string().uuid(),
  unit: EntryUnitSchema.optional(),
  portion_id: z.string().uuid().nullish(),
  /** Explicit position within the slot; omitted = appended (B-261). Mirrors the meal template's
   *  create. It exists so undoing a removed pin puts it back where it was, instead of at the end. */
  order_index: z.number().int().min(0).optional(),
});
export type CreatePantryRequest = z.infer<typeof CreatePantrySchema>;

/** Change a pin's prefill unit (GM-2/B-094): persists + cascades to today+future qty-0 lines. */
export const UpdatePantrySchema = z.object({
  unit: EntryUnitSchema,
  portion_id: z.string().uuid().nullish(),
});
export type UpdatePantryRequest = z.infer<typeof UpdatePantrySchema>;

/** A stored pantry pin as returned by the API (ordered by insertion). */
export interface PantryItem {
  id: string;
  meal_slot_name: string;
  food_id: string;
  unit: EntryUnit;
  portion_id: string | null;
  order_index: number;
}
