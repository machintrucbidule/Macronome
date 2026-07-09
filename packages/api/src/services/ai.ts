import {
  ErrorCode,
  type Advice,
  type DishPhotoMacros,
  type DishPhotoMacrosRequest,
  type MealProposal,
  type MealSuggestions,
  type MealSuggestionsRequest,
} from '@macronome/shared';
import type { Advice as AdviceModel } from '@prisma/client';
import { ApiError } from '../http/errors.js';
import { buildDishPhotoMessages, parseDishPhotoResult } from '../domain/ai-dish-photo/index.js';
import { buildAdviceMessages, parseAdvice } from '../domain/ai-advice/index.js';
import { adviceRepo } from '../data/repositories/advice.repo.js';
import { buildAdviceData } from './advice-data.js';
import {
  buildMealSuggestionsMessages,
  dayUsedFoods,
  parseMealSuggestions,
  type ChefFood,
  type DayUsedMeal,
  type ParsedItem,
} from '../domain/ai-meal-suggestions/index.js';
import { computeRemaining, isOnTarget } from '../domain/meal-solver/remaining.js';
import { penalty } from '../domain/meal-solver/penalty.js';
import { solve } from '../domain/meal-solver/solve.js';
import { aggregate, verifyProposal } from '../domain/meal-solver/verify.js';
import type {
  DayContext,
  Macros,
  SolverCandidate,
  TargetSnapshot,
} from '../domain/meal-solver/types.js';
import { aiSuggestionsRepo } from '../data/repositories/ai-suggestions.repo.js';
import * as aiProvider from './ai-provider.js';
import * as daysService from './days.js';
import { get as getSettings, rawAiConfig } from './settings.js';

// AI *use* orchestration (spec/api/ai.md, spec/logic/ai-dish-photo-macros.md, B-118). Reads the
// stored (secret-bearing) ai config, assembles the multimodal prompt, calls the vision model and
// parses the response. Persists nothing — returns an estimate the client maps into the form.

export async function dishPhotoMacros(
  userId: string,
  body: DishPhotoMacrosRequest,
): Promise<DishPhotoMacros> {
  const ai = await rawAiConfig(userId);
  const model = ai?.tasks.dish_photo_macros.model ?? null;
  // The link may be set but this task not (null model) → treat as not configured (§6 error table).
  if (model === null) throw new ApiError(409, ErrorCode.AiNotConfigured);

  // dish_name is returned in the user's UI language (B-119).
  const locale = (await getSettings(userId))?.locale ?? 'fr';
  const messages = buildDishPhotoMessages(
    ai!.tasks.dish_photo_macros.prompt,
    body.note,
    body.images,
    locale,
  );
  const text = await aiProvider.chatCompletion(ai, model, messages);

  const parsed = parseDishPhotoResult(text);
  if (!parsed.ok) throw new ApiError(502, ErrorCode.AiBadResponse);
  return parsed.data;
}

// AI meal-suggestions orchestration (spec/api/ai.md, spec/logic/ai-meal-suggestions.md +
// meal-solver.md, B-123). The hybrid: the LLM (chef) picks foods, the pure deterministic solver
// (accountant) sets quantities, and the verifier recomputes the day total IN CODE — the "fits the
// targets" claim is never trusted from the model. Persists nothing; the client applies a chosen
// proposal through the normal POST /meals/:id/entries flow.

/** Build the solver's day context from a `GET /days/:date` detail. A day with no Target carries the
 *  `cal_min===0 && cal_max===0` sentinel (day-verdict/snapshot.ts) → map the band to null so
 *  `computeRemaining` signals `no_target`. Floors/ceiling are already nullable. */
function toDayContext(day: Awaited<ReturnType<typeof daysService.get>>): DayContext {
  const t = day.target_snapshot;
  const hasTarget = t.cal_max > 0;
  const targets: TargetSnapshot = {
    cal_min: hasTarget ? t.cal_min : null,
    cal_max: hasTarget ? t.cal_max : null,
    protein_floor_g: t.protein_floor_g,
    fat_floor_g: t.fat_floor_g,
    carb_ceiling_g: t.carb_ceiling_g,
  };
  const entered: Macros = {
    kcal: day.totals.kcal,
    protein: day.totals.protein,
    fat: day.totals.fat,
    carb: day.totals.carb,
  };
  return { targets, entered };
}

/** The working day's already-eaten entries, per meal, for the chef's day-awareness (§2.2/§3.1,
 *  B-125/B-126/B-127). `consumed.grams` is the leftover-adjusted weight; fall back to `served_grams`
 *  (0 when neither — a placeholder line, which `dayUsedFoods` then skips). */
function toDayUsedMeals(day: Awaited<ReturnType<typeof daysService.get>>): DayUsedMeal[] {
  return day.meals.map((m) => ({
    meal_name: m.slot_name,
    entries: m.entries.map((e) => ({
      food_id: e.food_id,
      custom_name: e.custom_name,
      consumed_grams: e.consumed.grams ?? e.served_grams ?? 0,
    })),
  }));
}

/** One LLM-picked, pool-validated item → a solver candidate. `parse` guarantees `food_id` is in the
 *  pool and `portion_id` is one of the food's portions or null. */
function toCandidate(item: ParsedItem, pool: Map<string, ChefFood>): SolverCandidate {
  const food = pool.get(item.food_id)!;
  const portion =
    item.portion_id === null
      ? null
      : (food.portions.find((p) => p.portion_id === item.portion_id) ?? null);
  return {
    food_id: food.food_id,
    meal_id: item.meal_id,
    food_name: food.name,
    rating: food.rating,
    per100g: food.per100g,
    portion,
  };
}

export async function mealSuggestions(
  userId: string,
  body: MealSuggestionsRequest,
): Promise<MealSuggestions> {
  const ai = await rawAiConfig(userId);
  const model = ai?.tasks.meal_suggestions.model ?? null;
  if (model === null) throw new ApiError(409, ErrorCode.AiNotConfigured);

  const day = await daysService.get(userId, body.date);
  const ctx = toDayContext(day);
  const rem = computeRemaining(ctx);
  if (!rem.ok) throw new ApiError(422, ErrorCode.ValidationError, { reason: rem.reason });

  // null only when the carb ceiling is dropped (Target but no weigh-in); the DTO requires a number
  // — 0 mirrors `need_*_g = 0` for dropped floors (meal-solver.md §1).
  const remaining = {
    cal_min: rem.remaining.rem_cal_min,
    cal_max: rem.remaining.rem_cal_max,
    need_protein_g: rem.remaining.need_protein,
    need_fat_g: rem.remaining.need_fat,
    carb_room_g: rem.remaining.carb_room ?? 0,
    entered: ctx.entered,
  };

  // B-124: the day is already within the band + floors met → nothing useful to add. Short-circuit
  // before the model call and return a graceful on-target state (never refuse, never call the LLM).
  if (isOnTarget(rem.remaining)) {
    return { status: 'on_target', remaining, proposals: [] };
  }

  const usedMeals = toDayUsedMeals(day);
  const referencedFoodIds = [
    ...new Set(
      usedMeals
        .flatMap((m) => m.entries.map((e) => e.food_id))
        .filter((x): x is string => x !== null),
    ),
  ];
  const [pool, history, nameById] = await Promise.all([
    aiSuggestionsRepo.candidatePool(userId),
    aiSuggestionsRepo.okDayHistory(userId, body.date),
    aiSuggestionsRepo.foodNamesByIds(userId, referencedFoodIds),
  ]);

  // B-125/B-126/B-127: day-awareness — surface the foods already on the day for coherence, and drop
  // any eaten >25 g today from the candidate pool so the chef can't re-propose it (and the parse
  // drops it if hallucinated). Condiments (≤25 g) stay in the pool, so they may recur.
  const { alreadyOnDay, excludedFoodIds } = dayUsedFoods(usedMeals, nameById);
  const excludedSet = new Set(excludedFoodIds);
  const candidates = pool.filter((f) => !excludedSet.has(f.food_id));

  const mealNameById = new Map(day.meals.map((m) => [m.id, m.slot_name]));
  const messages = buildMealSuggestionsMessages(
    ai!.tasks.meal_suggestions.prompt,
    {
      remaining: rem.remaining,
      meals: body.meal_ids.map((id) => ({ meal_id: id, name: mealNameById.get(id) ?? '' })),
      candidates,
      history,
      ...(alreadyOnDay.length > 0 ? { alreadyOnDay } : {}),
      ...(body.note !== undefined ? { precisions: body.note } : {}),
      ...(body.constraints !== undefined ? { constraints: body.constraints } : {}),
    },
    ai!.avoidances,
  );
  const text = await aiProvider.chatCompletion(ai, model, messages);

  const poolMap = new Map(candidates.map((f) => [f.food_id, f]));
  const parsed = parseMealSuggestions(text, poolMap, new Set(body.meal_ids));
  if (!parsed.ok) throw new ApiError(502, ErrorCode.AiBadResponse);

  const proposals: MealProposal[] = parsed.proposals.map((p, i) => {
    const candidates = p.items.map((it) => toCandidate(it, poolMap));
    const solved = solve({
      candidates,
      ctx,
      ...(body.constraints?.pinned !== undefined ? { pinned: body.constraints.pinned } : {}),
      ...(body.constraints?.excluded_food_ids !== undefined
        ? { excludedFoodIds: body.constraints.excluded_food_ids }
        : {}),
    });
    const verified = verifyProposal(solved, ctx);
    const { dayAgg, addedCarb } = aggregate(solved, ctx.entered);
    const fit = penalty(dayAgg, addedCarb, ctx.targets).hard === 0 ? 'full' : 'closest';
    return {
      id: `p${i + 1}`,
      fit,
      items: verified.items,
      day_total: verified.day_total,
      targets_met: verified.targets_met,
      gaps: verified.gaps,
    };
  });

  return { status: 'proposals', remaining, proposals };
}

// AI advice orchestration (spec/api/ai.md, spec/logic/ai-advice.md, B-202). The third AI use, and the
// only one that PERSISTS: assemble the user's data (server-side), call the model, and ARCHIVE the
// free-Markdown reply + the data snapshot. List/delete operate on that archive (user-scoped).

const toAdviceDto = (row: AdviceModel): Advice => ({
  id: row.id,
  created_at: row.createdAt.toISOString(),
  model: row.model,
  content: row.content,
  snapshot: row.snapshot as Record<string, unknown>,
});

/** Generate + archive one advice. 409 when the advice task has no model; 502 on an empty reply. */
export async function generateAdvice(userId: string): Promise<Advice> {
  const ai = await rawAiConfig(userId);
  const model = ai?.tasks.advice.model ?? null;
  if (model === null) throw new ApiError(409, ErrorCode.AiNotConfigured);

  const locale = (await getSettings(userId))?.locale ?? 'fr';
  const today = new Date().toISOString().slice(0, 10);
  const payload = await buildAdviceData(userId, today);
  const messages = buildAdviceMessages(ai!.tasks.advice.prompt, payload, locale, ai!.avoidances);
  const text = await aiProvider.chatCompletion(ai, model, messages);

  const parsed = parseAdvice(text);
  if (!parsed.ok) throw new ApiError(502, ErrorCode.AiBadResponse);

  const row = await adviceRepo.create(userId, { model, content: parsed.data, snapshot: payload });
  return toAdviceDto(row);
}

/** The user's archived advices, newest first. */
export async function listAdvice(userId: string): Promise<Advice[]> {
  return (await adviceRepo.list(userId)).map(toAdviceDto);
}

/** Delete one archived advice; false when the id is unknown / another tenant's (→ 404). */
export function deleteAdvice(userId: string, id: string): Promise<boolean> {
  return adviceRepo.remove(userId, id);
}
