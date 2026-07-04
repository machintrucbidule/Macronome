import type { ChronoFoodPrefill, ChronoProductSummary } from '@macronome/shared';

// Pure product → food mapping for the Chronodrive search (B-182,
// spec/logic/integrations-connections.md §8): macros are mapped ONLY for a
// 100 g / 100 ml nutrition base (anything else → null, never rescaled); an absent
// field maps to null; kcal comes from energyKcal only (never derived from kJ).

/** Raw gateway product shapes (v0.4.1) — only the fields this mapping reads. */
export interface RawGatewayProduct {
  id?: unknown;
  name?: unknown;
  brand?: unknown;
  unitQuantityLabel?: unknown;
  image?: unknown;
  price?: { default?: unknown } | undefined;
  nutrition?:
    | {
        base?: unknown;
        energyKcal?: unknown;
        energyKj?: unknown;
        fat?: unknown;
        carbohydrate?: unknown;
        protein?: unknown;
      }
    | undefined;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** §8.1 — compact search-row shaping (snake_case, absent → null). */
export function mapSummary(raw: RawGatewayProduct): ChronoProductSummary {
  return {
    id: str(raw.id) ?? '',
    name: str(raw.name) ?? '',
    brand: str(raw.brand),
    image_url: str(raw.image),
    unit_quantity_label: str(raw.unitQuantityLabel),
    price_eur: num(raw.price?.default),
  };
}

/** §8.2 — food pre-fill mapping (macros gated on the 100 g / 100 ml base). */
export function mapProduct(raw: RawGatewayProduct): ChronoFoodPrefill {
  const nutrition = raw.nutrition;
  const base = str(nutrition?.base);
  const mappable = base === '100 g' || base === '100 ml';
  return {
    name: [str(raw.brand), str(raw.name)].filter(Boolean).join(' '),
    kcal_per_100g: mappable ? num(nutrition?.energyKcal) : null,
    fat_per_100g: mappable ? num(nutrition?.fat) : null,
    carb_per_100g: mappable ? num(nutrition?.carbohydrate) : null,
    protein_per_100g: mappable ? num(nutrition?.protein) : null,
    comment: str(raw.unitQuantityLabel),
  };
}
