import type { ChefFood, ChefParseResult, ParsedItem, ParsedProposal } from './types.js';

// Response parsing & validation (spec/logic/ai-meal-suggestions.md §6). Pure: reuse the tolerant
// approach of `ai-dish-photo/parse.ts` — unwrap an optional markdown code fence, take the first
// balanced { … } object, JSON.parse — then validate each item against the candidate pool + the
// selected meals, repair portions, drop empty proposals, and de-dup identical food-id multisets.
// Zero surviving proposals (or unparseable input) → { ok: false } (service → ai_bad_response).

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

/**
 * Resolve `portion_id` for one item (§6). Portionless food → always null (coerce away any value).
 * Portioned food → the given id if it is one of the food's portions, else the **first** portion
 * (null/invalid falls back rather than dropping the item).
 */
function resolvePortion(food: ChefFood, raw: unknown): string | null {
  const [first] = food.portions;
  if (!first) return null; // portionless → coerce any value to null
  if (typeof raw === 'string' && food.portions.some((p) => p.portion_id === raw)) return raw;
  return first.portion_id; // null/invalid → fall back to the food's first portion
}

/** A food-id multiset signature for distinctness de-dup (only food ids matter, §6). */
function signature(items: ParsedItem[]): string {
  return items
    .map((i) => i.food_id)
    .sort()
    .join('|');
}

/** Validate one reply item: ids must resolve against the pool + selected meals; portion repaired.
 *  Returns null to drop the item (unknown food_id / meal_id / malformed shape). */
function validateItem(
  raw: unknown,
  pool: Map<string, ChefFood>,
  mealIds: Set<string>,
): ParsedItem | null {
  const it = raw as { food_id?: unknown; meal_id?: unknown; portion_id?: unknown } | null;
  if (typeof it?.food_id !== 'string' || typeof it.meal_id !== 'string') return null;
  const food = pool.get(it.food_id);
  if (!food || !mealIds.has(it.meal_id)) return null;
  return {
    food_id: it.food_id,
    meal_id: it.meal_id,
    portion_id: resolvePortion(food, it.portion_id),
  };
}

/** Validate one proposal: keep its surviving items, or null when none survive (drop it). */
function validateProposal(
  raw: unknown,
  pool: Map<string, ChefFood>,
  mealIds: Set<string>,
): ParsedItem[] | null {
  const itemsRaw = (raw as { items?: unknown } | null)?.items;
  if (!Array.isArray(itemsRaw)) return null;
  const items = itemsRaw
    .map((r) => validateItem(r, pool, mealIds))
    .filter((x): x is ParsedItem => x !== null);
  return items.length > 0 ? items : null;
}

export function parseMealSuggestions(
  text: string,
  pool: Map<string, ChefFood>,
  mealIds: Set<string>,
): ChefParseResult {
  const json = extractJsonObject(text);
  if (json === null) return { ok: false };
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return { ok: false };
  }
  const proposalsRaw = (obj as { proposals?: unknown }).proposals;
  if (!Array.isArray(proposalsRaw)) return { ok: false };

  const proposals: ParsedProposal[] = [];
  const seen = new Set<string>();
  for (const pRaw of proposalsRaw) {
    const items = validateProposal(pRaw, pool, mealIds);
    if (!items) continue; // no valid items → drop the proposal
    const sig = signature(items);
    if (seen.has(sig)) continue; // identical food-id multiset → de-dup
    seen.add(sig);
    proposals.push({ items });
  }

  if (proposals.length === 0) return { ok: false }; // zero valid → ai_bad_response
  return { ok: true, proposals };
}
