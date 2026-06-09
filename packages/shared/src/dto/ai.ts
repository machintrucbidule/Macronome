import { z } from 'zod';

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
