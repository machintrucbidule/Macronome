import { z } from 'zod';

// Chronodrive product-search DTOs (spec/api/integrations.md, B-182). Shapes returned by
// the BarclaudeGateway proxies; the product → food mapping producing ChronoFoodPrefill
// is server-side (spec/logic/integrations-connections.md §8.2 — rule 2: the web never
// computes a nutrition figure).

/** Compact search-result row (§8.1) — absent upstream fields are null. */
export interface ChronoProductSummary {
  id: string;
  name: string;
  brand: string | null;
  /** Absolute public URL; thumbnails load browser-side (not proxied in v1). */
  image_url: string | null;
  /** e.g. "500 g" — the upstream unitQuantityLabel. */
  unit_quantity_label: string | null;
  /** Display-only price in euros (upstream price.default). */
  price_eur: number | null;
}

/** Server-side product → food pre-fill (§8.2) — null leaves the draft field empty. */
export interface ChronoFoodPrefill {
  name: string;
  kcal_per_100g: number | null;
  fat_per_100g: number | null;
  carb_per_100g: number | null;
  protein_per_100g: number | null;
  comment: string | null;
}

/** GET /integrations/barclaude-gateway/products/:id response payload. */
export type ChronoProductResponse = ChronoProductSummary & { food_prefill: ChronoFoodPrefill };

/** GET /integrations/barclaude-gateway/search query — min 3 chars after trim (§8.1). */
export const ChronoSearchQuerySchema = z.object({
  q: z.string().trim().min(3, { message: 'too_short' }),
});
export type ChronoSearchQuery = z.infer<typeof ChronoSearchQuerySchema>;
