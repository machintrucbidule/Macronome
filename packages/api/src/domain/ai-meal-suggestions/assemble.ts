import type { ChatMessage } from '../ai-dish-photo/index.js';
import { MEAL_SUGGESTIONS_FORMAT_INSTRUCTION } from './format.js';
import type { ChefContext, ChefFood, DayMealFoods, HistoryDay } from './types.js';

// Prompt assembly (spec/logic/ai-meal-suggestions.md §2). One `user` message with a single text
// part: the configured scope prompt, then a structured, deterministic context block (§2.2), then
// the hard-coded format instruction (§2.3) — in that order. No dish-name language clause (§2:
// nothing localised is returned). By construction the context block carries only food/meal data
// and anonymous numbers — never identity, weight, or BMI (Privacy §5).

/** Candidate food in the §2.2 wire shape (per-100 g macros flattened). */
function candidateWire(f: ChefFood): Record<string, unknown> {
  return {
    food_id: f.food_id,
    name: f.name,
    kcal_100g: f.per100g.kcal,
    protein_100g: f.per100g.protein,
    fat_100g: f.per100g.fat,
    carb_100g: f.per100g.carb,
    rating: f.rating,
    portions: f.portions.map((p) => ({ portion_id: p.portion_id, label: p.label, grams: p.grams })),
  };
}

/** OK-day history in the §2.2 wire shape: `{ date_offset, meal_name, foods: ["name × qty"] }`. */
function historyWire(h: HistoryDay): Record<string, unknown> {
  return {
    date_offset: h.date_offset,
    meal_name: h.meal_name,
    foods: h.foods.map((x) => `${x.name} × ${x.qty}`),
  };
}

/** Already-on-the-day meal in the §2.2 wire shape: `{ meal_name, foods: ["name × qty"] }`. */
function alreadyOnDayWire(d: DayMealFoods): Record<string, unknown> {
  return { meal_name: d.meal_name, foods: d.foods.map((x) => `${x.name} × ${x.qty}`) };
}

/** App-owned avoidances block from the user's persisted allergies/dislikes free text (B-216,
 *  spec/logic/ai-meal-suggestions.md §2.2). Best-effort — the model must never propose a food
 *  matching this list, on top of the deterministic candidate filtering. `''` when unset. */
function avoidancesBlock(avoidances?: string): string {
  const text = (avoidances ?? '').trim();
  if (text === '') return '';
  return (
    `\n\nAVOID (user allergies/dislikes, free text)\n${text}\n` +
    'Never include any food matching these, even if it would otherwise be a good fit.'
  );
}

/** The refine constraints block (§2.2), or `''` when there is nothing to constrain. */
function constraintsBlock(c: ChefContext['constraints']): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.excluded_food_ids?.length)
    parts.push(`excluded_food_ids: ${JSON.stringify(c.excluded_food_ids)}`);
  if (c.pinned?.length) parts.push(`pinned: ${JSON.stringify(c.pinned)}`);
  if (c.avoid?.length) parts.push(`avoid: ${JSON.stringify(c.avoid)}`);
  return parts.length ? `\n\nCONSTRAINTS\n${parts.join('\n')}` : '';
}

/** Build the deterministic context block (§2.2) appended after the scope prompt. */
function contextBlock(ctx: ChefContext): string {
  const r = ctx.remaining;
  const remaining = [
    'REMAINING TARGETS',
    `rem_cal_min: ${r.rem_cal_min}`,
    `rem_cal_max: ${r.rem_cal_max}`,
    `need_protein: ${r.need_protein}`,
    `need_fat: ${r.need_fat}`,
    `carb_room: ${r.carb_room === null ? 'none' : r.carb_room}`,
  ].join('\n');
  const meals = `SELECTED MEALS\n${JSON.stringify(ctx.meals)}`;
  const candidates = `CANDIDATE FOODS\n${JSON.stringify(ctx.candidates.map(candidateWire))}`;
  const alreadyOnDay =
    ctx.alreadyOnDay && ctx.alreadyOnDay.length > 0
      ? `\n\nALREADY ON THE DAY\n${JSON.stringify(ctx.alreadyOnDay.map(alreadyOnDayWire))}`
      : '';
  const history = `OK-DAY HISTORY\n${JSON.stringify(ctx.history.map(historyWire))}`;
  const precisions =
    ctx.precisions && ctx.precisions.trim() !== ''
      ? `\n\nPRECISIONS\n${ctx.precisions.trim()}`
      : '';
  return `${remaining}\n\n${meals}\n\n${candidates}${alreadyOnDay}\n\n${history}${precisions}${constraintsBlock(
    ctx.constraints,
  )}`;
}

export function buildMealSuggestionsMessages(
  prompt: string,
  ctx: ChefContext,
  avoidances?: string,
): ChatMessage[] {
  const text =
    `${prompt}\n\n${contextBlock(ctx)}${avoidancesBlock(avoidances)}\n\n` +
    `${MEAL_SUGGESTIONS_FORMAT_INSTRUCTION}`;
  return [{ role: 'user', content: [{ type: 'text', text }] }];
}
