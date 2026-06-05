import { z } from 'zod';

// Meal-template DTOs (spec/api §Settings "GET/POST/PATCH/DELETE /meal-template",
// spec/schema/tables-logging.md → meal_slot_template). The ordered default day structure
// edited in Paramètres; seeds the meals of each new day. Meal names are user data (never
// translated).

export const CreateMealTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  order_index: z.number().int().min(0).optional(),
});
export type CreateMealTemplateRequest = z.infer<typeof CreateMealTemplateSchema>;

export const PatchMealTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    order_index: z.number().int().min(0).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'empty_patch' });
export type PatchMealTemplateRequest = z.infer<typeof PatchMealTemplateSchema>;

/** A stored template slot as returned by the API (ordered). */
export interface MealTemplateItem {
  id: string;
  name: string;
  order_index: number;
}
