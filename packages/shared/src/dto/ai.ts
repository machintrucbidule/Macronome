import { z } from 'zod';
import { RatingSchema } from './food.js';

// AI *use* DTOs (spec/api/ai.md, spec/logic/ai-dish-photo-macros.md, B-118). The dish-photo
// estimate takes 1..4 dish photos (data URLs) + an optional note and returns one aggregated
// totals estimate that pre-fills the Repas custom-entry form. Persists nothing.

/** A base64 data URL for an accepted image MIME (jpeg/png/webp). */
const ImageDataUrlSchema = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,/, { message: 'invalid_image' });

/**
 * POST /ai/dish-photo-macros request body. Up to 4 photos and/or a note; **at least one** of
 * the two must be present (an image alone, a note alone, or both — spec/api/ai.md).
 */
export const DishPhotoMacrosRequestSchema = z
  .object({
    images: z.array(ImageDataUrlSchema).max(4).default([]),
    note: z.string().max(500).optional(),
  })
  .refine((b) => b.images.length > 0 || (b.note?.trim().length ?? 0) > 0, {
    message: 'image_or_note_required',
  });
export type DishPhotoMacrosRequest = z.infer<typeof DishPhotoMacrosRequestSchema>;

/** Aggregated estimate — all numbers are totals in SI units (g, kcal). Maps 1:1 to the form. */
export const DishPhotoMacrosSchema = z.object({
  dish_name: z.string(),
  kcal: z.number(),
  weight_g: z.number(),
  fat_g: z.number(),
  carb_g: z.number(),
  protein_g: z.number(),
});
export type DishPhotoMacros = z.infer<typeof DishPhotoMacrosSchema>;

export interface DishPhotoMacrosResponse {
  data: DishPhotoMacros;
}

// --- Meal suggestions (spec/api/ai.md, spec/logic/ai-meal-suggestions.md + meal-solver.md, B-123) --
// The LLM (chef) picks foods; a pure deterministic solver (accountant) sets quantities; the
// service recomputes the day total in code (verifier). The "fits the targets" claim is NEVER
// trusted from the model — `day_total`/`targets_met`/`gaps` are computed server-side. Persists
// nothing (the client applies a chosen proposal through the normal POST /meals/:id/entries flow).

/** POST /ai/meal-suggestions request body. `meal_ids` is ≥ 1 of the day's meal ids; `constraints`
 * carries the client-held refine loop (exclusions, pinned quantities, avoid signatures). */
export const MealSuggestionsRequestSchema = z.object({
  date: z.string().date(),
  meal_ids: z.array(z.string().uuid()).min(1),
  note: z.string().max(500).optional(),
  constraints: z
    .object({
      excluded_food_ids: z.array(z.string().uuid()).optional(),
      pinned: z
        .array(
          z.object({
            food_id: z.string().uuid(),
            meal_id: z.string().uuid(),
            portion_id: z.string().uuid().nullable(),
            grams: z.number().nonnegative(),
          }),
        )
        .optional(),
      avoid: z.array(z.array(z.string().uuid())).optional(),
    })
    .optional(),
});
export type MealSuggestionsRequest = z.infer<typeof MealSuggestionsRequestSchema>;

/** A macro snapshot (totals, SI units). Shared by each item's `snap` and the certified `day_total`. */
const MacroSnapSchema = z.object({
  kcal: z.number(),
  fat: z.number(),
  carb: z.number(),
  protein: z.number(),
});

/** One proposed food line: a food assigned to a meal, with the solver's quantity + a macro snap. */
export const MealProposalItemSchema = z.object({
  food_id: z.string().uuid(),
  food_name: z.string(),
  meal_id: z.string().uuid(),
  portion_id: z.string().uuid().nullable(),
  portion_label: z.string().nullable(),
  served_quantity: z.number(),
  unit: z.enum(['g', 'portion']),
  served_grams: z.number(),
  snap: MacroSnapSchema,
  rating: RatingSchema,
});

/** One proposal: its items + the server-certified day total, fit, and gaps (never from the LLM). */
export const MealProposalSchema = z.object({
  id: z.string(),
  fit: z.enum(['full', 'closest']),
  items: z.array(MealProposalItemSchema),
  day_total: MacroSnapSchema,
  targets_met: z.object({
    calorie: z.boolean(),
    protein: z.boolean(),
    fat: z.boolean(),
    carb: z.boolean(),
  }),
  gaps: z.array(
    z.union([
      z.object({ target: z.enum(['protein_floor', 'fat_floor']), short_g: z.number() }),
      z.object({ target: z.literal('calorie'), delta_kcal: z.number() }),
    ]),
  ),
});

/** The full response payload: the day-wide remaining targets + the 3 (or fewer) proposals. */
export const MealSuggestionsSchema = z.object({
  remaining: z.object({
    cal_min: z.number(),
    cal_max: z.number(),
    need_protein_g: z.number(),
    need_fat_g: z.number(),
    carb_room_g: z.number(),
    entered: MacroSnapSchema,
  }),
  proposals: z.array(MealProposalSchema),
});

export type MealProposalItem = z.infer<typeof MealProposalItemSchema>;
export type MealProposal = z.infer<typeof MealProposalSchema>;
export type MealSuggestions = z.infer<typeof MealSuggestionsSchema>;

export interface MealSuggestionsResponse {
  data: MealSuggestions;
}
