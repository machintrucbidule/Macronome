import type { AdviceDayMeals, AdviceMealLine, AdvicePayload } from '../domain/ai-advice/index.js';
import { buildAdvicePayload, windowStart } from '../domain/ai-advice/index.js';
import { dayReadRepo } from '../data/repositories/day-read.repo.js';
import { aiSuggestionsRepo } from '../data/repositories/ai-suggestions.repo.js';
import { mealDto } from './day-assembler.js';
import * as profileService from './profile.js';
import * as targetsService from './targets.js';
import * as targetHistoryService from './target-history.js';
import * as weightService from './weight.js';
import * as statsService from './stats.js';
import { listAllLogged } from './journal.js';

// Aggregator for the advice use (spec/logic/ai-advice.md §3, B-202). Fetches the user's existing
// read-services / repos, resolves the 30-day consumed meal food-lines, loops adherence over ALL
// logged years, then delegates the pure shaping to the ai-advice domain. The web never computes any
// of this (CLAUDE.md rule 2). The returned object is BOTH the prompt context and the archived snapshot.

const ADVICE_WINDOW_DAYS = 30;
const r0 = (v: number | null | undefined): number => Math.round(v ?? 0);

/** Adherence monthly pivot over EVERY logged year (not a window) + the latest year's key/signals/
 *  records (already all-time in `key.overall_ok_rate` / `records.all`). Empty when no logged day. */
async function allHistoryAdherence(
  userId: string,
): Promise<Pick<AdvicePayload['adherence'], 'monthly' | 'key' | 'signals' | 'records'>> {
  const { minYear, maxYear } = await dayReadRepo.yearRange(userId);
  if (minYear === null || maxYear === null) {
    return { monthly: [], key: null, signals: [], records: null };
  }
  const years = [];
  for (let y = minYear; y <= maxYear; y++) years.push(y);
  const perYear = await Promise.all(years.map((y) => statsService.getAdherence(userId, y)));
  const monthly = perYear.flatMap((a) => a.monthly);
  const latest = perYear[perYear.length - 1]!; // maxYear — carries all-time key/records
  return { monthly, key: latest.key, signals: latest.signals, records: latest.records };
}

/** The last 30 days as consumed food-lines (name · qty · macros), resolved via day-assembler + the
 *  food-name lookup. Custom lines use their own name; unresolvable / zero-weight lines are skipped. */
async function recentMeals(userId: string, today: string): Promise<AdviceDayMeals[]> {
  const from = windowStart(today, ADVICE_WINDOW_DAYS);
  const aggregates = await dayReadRepo.readRange(userId, from, today);
  const days = aggregates.map((agg) => ({
    date: agg.dayLog.date.toISOString().slice(0, 10),
    meals: agg.meals.map((m) => mealDto(m)),
  }));
  const refIds = [
    ...new Set(
      days.flatMap((d) =>
        d.meals.flatMap((m) => m.entries.map((e) => e.food_id).filter((x): x is string => !!x)),
      ),
    ),
  ];
  const nameById = await aiSuggestionsRepo.foodNamesByIds(userId, refIds);
  return days.map((d) => ({
    date: d.date,
    meals: d.meals.map((m) => ({
      slot_name: m.slot_name,
      lines: m.entries
        .map((e): AdviceMealLine | null => {
          const name =
            e.kind === 'custom' ? e.custom_name : (nameById.get(e.food_id ?? '') ?? null);
          if (!name || (e.consumed.grams ?? 0) <= 0) return null; // skip empty / unresolvable lines
          return {
            name,
            quantity: r0(e.consumed.quantity),
            unit: e.unit,
            kcal: r0(e.consumed.kcal),
            fat: r0(e.consumed.fat),
            carb: r0(e.consumed.carb),
            protein: r0(e.consumed.protein),
          };
        })
        .filter((l): l is AdviceMealLine => l !== null),
    })),
  }));
}

/** Assemble the full advice payload (= the prompt context = the archived snapshot). */
export async function buildAdviceData(userId: string, today: string): Promise<AdvicePayload> {
  const [profile, target, history, weight, rolling, adherence, journal, meals30d] =
    await Promise.all([
      profileService.get(userId),
      targetsService.get(userId),
      targetHistoryService.list(userId),
      weightService.get(userId, 'all'),
      statsService.getRolling(userId),
      allHistoryAdherence(userId),
      listAllLogged(userId),
      recentMeals(userId, today),
    ]);
  return buildAdvicePayload({
    today,
    profile,
    engine: target.engine,
    target: target.target,
    targetHistory: history.versions,
    cartouche: weight.cartouche,
    ema: weight.ema,
    trajectory: weight.trajectory,
    periods: weight.periods,
    rolling: rolling.windows,
    adherenceMonthly: adherence.monthly,
    adherenceKey: adherence.key,
    signals: adherence.signals,
    records: adherence.records,
    journal,
    meals30d,
  });
}
