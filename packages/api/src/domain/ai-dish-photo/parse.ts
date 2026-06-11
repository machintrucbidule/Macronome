import type { DishPhotoMacros } from '@macronome/shared';

// Response parsing & validation (spec/logic/ai-dish-photo-macros.md §4). Pure: unwrap an
// optional markdown code fence, take the first balanced { … } object, JSON.parse, then — when a
// food is detected — coerce numeric strings (comma → dot), validate dish_name non-empty + 5
// numbers finite ≥ 0, map calories_kcal → kcal. When `detected:false` (DS-1/B-160) short-circuit
// to a zeroed result without validation (the web shows a no-food message, no pre-fill). Any
// failure → { ok: false } (the service maps it to ai_bad_response).

export type DishPhotoParseResult = { ok: true; data: DishPhotoMacros } | { ok: false };

/** Strip an optional ```/```json fence, then return the first balanced {…} substring. */
function extractJsonObject(text: string): string | null {
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

/** Accept a number or a numeric string (comma → dot) → finite number, else null. */
function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Non-negative finite number after coercion. */
function nonNeg(v: unknown): number | null {
  const n = coerceNumber(v);
  return n !== null && n >= 0 ? n : null;
}

export function parseDishPhotoResult(text: string): DishPhotoParseResult {
  const json = extractJsonObject(text);
  if (json === null) return { ok: false };
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return { ok: false };
  }

  // detected: absent → true (back-compat with the pre-B-160 six-field format). When false, no food
  // was identified → zeroed result, no validation of the other fields (the web shows a no-food
  // message and pre-fills nothing, so dish_name/macros are irrelevant — spec §4 step 3).
  if (obj.detected === false) {
    return {
      ok: true,
      data: {
        detected: false,
        dish_name: '',
        kcal: 0,
        weight_g: 0,
        fat_g: 0,
        carb_g: 0,
        protein_g: 0,
      },
    };
  }

  if (typeof obj.dish_name !== 'string' || obj.dish_name.trim() === '') return { ok: false };

  const kcal = nonNeg(obj.calories_kcal);
  const weight_g = nonNeg(obj.weight_g);
  const fat_g = nonNeg(obj.fat_g);
  const carb_g = nonNeg(obj.carb_g);
  const protein_g = nonNeg(obj.protein_g);
  if (
    kcal === null ||
    weight_g === null ||
    fat_g === null ||
    carb_g === null ||
    protein_g === null
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    data: {
      detected: true,
      dish_name: obj.dish_name.trim(),
      kcal,
      weight_g,
      fat_g,
      carb_g,
      protein_g,
    },
  };
}
