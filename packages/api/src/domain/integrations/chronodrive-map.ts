import type { ChronoFoodPrefill, ChronoProductSummary } from '@macronome/shared';

// Pure product → food mapping for the Chronodrive search (B-182,
// spec/logic/integrations-connections.md §8). The live gateway's `nutrition.base` is
// free text or absent (§8.2), so the per-100 gate is a rule, not an equality:
// absent base → per-100 by law (EU INCO mandatory declaration); present base → must
// reference 100 g/ml in any spelling; anything else → all macros null (never silently
// rescaled). An absent macro field maps to null; kcal comes from energyKcal only
// (never derived from kJ).

const CHRONODRIVE_PRODUCT_URL = 'https://www.chronodrive.com/p-P';

// On the normalised base (lowercased, spaces stripped): `100`, optional `.0+`/`,0+`
// decimals ("100.000gr"), then a mass/volume unit — not preceded by a digit ("1000g")
// and not followed by a letter. Covers every live-observed per-100 spelling (§8.3.9).
const PER_100_RE = /(?<!\d)100(?:[.,]0+)?(?:grammes?|gr|g|ml)(?![a-z])/;

/** §8.2 base gate — absent/empty base counts as per-100 (INCO default). */
function isPer100(base: string | null): boolean {
  if (base === null) return true;
  return PER_100_RE.test(base.toLowerCase().replace(/\s+/g, ''));
}

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
  const id = str(raw.id);
  return {
    id: id ?? '',
    name: str(raw.name) ?? '',
    brand: str(raw.brand),
    image_url: str(raw.image),
    unit_quantity_label: str(raw.unitQuantityLabel),
    price_eur: num(raw.price?.default),
    product_url: id ? `${CHRONODRIVE_PRODUCT_URL}${id}` : null,
  };
}

/** §8.2 — food pre-fill mapping (macros gated on the tolerant per-100 base rule). */
export function mapProduct(raw: RawGatewayProduct): ChronoFoodPrefill {
  const nutrition = raw.nutrition;
  const mappable = isPer100(str(nutrition?.base));
  return {
    name: [str(raw.brand), str(raw.name)].filter(Boolean).join(' '),
    kcal_per_100g: mappable ? num(nutrition?.energyKcal) : null,
    fat_per_100g: mappable ? num(nutrition?.fat) : null,
    carb_per_100g: mappable ? num(nutrition?.carbohydrate) : null,
    protein_per_100g: mappable ? num(nutrition?.protein) : null,
    comment: str(raw.unitQuantityLabel),
  };
}
