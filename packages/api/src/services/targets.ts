import {
  ACTIVITY_MULTIPLIERS,
  type ActivityLevel,
  type CreateTargetRequest,
  type GetTargetResponse,
  type PreviewTargetRequest,
  type PreviewTargetResponse,
  RECENT_ACTIVITY_WINDOW_DAYS,
  type Sex,
  type SuggestTargetResponse,
} from '@macronome/shared';
import { Prisma, type Target as TargetModel } from '@prisma/client';
import { toDate } from '../data/repositories/day-read.repo.js';
import { dayStatRepo } from '../data/repositories/day-stat.repo.js';
import { profileRepo } from '../data/repositories/profile.repo.js';
import { targetRepo } from '../data/repositories/target.repo.js';
import { weightRepo } from '../data/repositories/weight.repo.js';
import {
  ageYears,
  estimatedBurn,
  mifflinStJeor,
  recentAvgActivity,
  type RecentActivity,
} from '../domain/metabolic/index.js';
import { suggestRange } from '../domain/targets/index.js';
import { todayString } from './day-context.js';
import { computeEngine, targetToDto } from './target-engine.js';

// Targets service: orchestration only (CLAUDE.md — logic lives in the domain). It reads
// the profile, current weight (latest weigh-in) and current target, then delegates the
// derivation to the pure engine. Recent-average activity is the mean of the logged days'
// activity multipliers within the trailing 30-calendar-day window (metabolic-engine.md
// §3); with no logged day in the window it falls back to sedentary + insufficient-data.

const num = (d: { toString(): string }): number => Number(d.toString());

/** Mean activity multiplier over the logged days of the trailing 30-day window ending at
 * `asOf` (default today; TH-1 lets the history editor compute the engine as of a version's
 * effective date). Bounds are at UTC midnight so the upper bound excludes later days and
 * no time-of-day drift narrows the window. Empty window → sedentary fallback. */
async function recentActivity(userId: string, asOf?: Date): Promise<RecentActivity> {
  const to = asOf ?? toDate(todayString());
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (RECENT_ACTIVITY_WINDOW_DAYS - 1));
  const levels = await dayStatRepo.activityLevelsInRange(userId, from, to);
  return recentAvgActivity(levels.map((l) => ACTIVITY_MULTIPLIERS[l as ActivityLevel]));
}

/** GET /target — the persisted target + live engine readout + non-blocking warnings. */
export async function get(userId: string): Promise<GetTargetResponse> {
  const refDate = new Date();
  const profile = await profileRepo.get(userId);
  if (!profile) throw new Error('profile_missing'); // an authed user always has one
  const [weightRow, targetRow] = await Promise.all([
    weightRepo.latestAsOf(userId, refDate),
    targetRepo.currentAsOf(userId, refDate),
  ]);
  const recent = await recentActivity(userId);
  const { engine, warnings } = computeEngine({ profile, weightRow, targetRow, recent, refDate });
  return { target: targetRow ? targetToDto(targetRow) : null, engine, warnings };
}

/** POST /target — upsert a target row for its effective date, then return GET state. */
export async function create(
  userId: string,
  body: CreateTargetRequest,
): Promise<GetTargetResponse> {
  await targetRepo.create(userId, {
    calorieMin: body.calorie_min,
    calorieMax: body.calorie_max,
    proteinGPerKg: body.protein_g_per_kg,
    fatGPerKg: body.fat_g_per_kg,
    targetWeightKg: body.target_weight_kg ?? null,
    rateKgPerWeek: body.rate_kg_per_week ?? null,
    effectiveFrom: new Date(body.effective_from),
  });
  return get(userId);
}

/** POST /target/preview — stateless engine readout for a draft (unsaved) target. Reads
 * the persisted profile + latest weigh-in (target-draft scope, DECISIONS B-042); writes
 * nothing. Lets the Cibles form recompute live while editing (CLAUDE.md rule 2: the web
 * never computes). The profile still refreshes the engine on its own PATCH-save. */
export async function preview(
  userId: string,
  body: PreviewTargetRequest,
): Promise<PreviewTargetResponse> {
  // Default: as of today. With effective_from (history editor), compute as of that date.
  const refDate = body.effective_from ? toDate(body.effective_from) : new Date();
  const profile = await profileRepo.get(userId);
  if (!profile) throw new Error('profile_missing'); // an authed user always has one
  const weightRow = await weightRepo.latestAsOf(userId, refDate);
  const recent = await recentActivity(userId, refDate);
  const dec = (n: number): Prisma.Decimal => new Prisma.Decimal(n);
  const draftRow: TargetModel = {
    id: 'preview',
    userId,
    calorieMin: body.calorie_min,
    calorieMax: body.calorie_max,
    proteinGPerKg: dec(body.protein_g_per_kg),
    fatGPerKg: dec(body.fat_g_per_kg),
    targetWeightKg: body.target_weight_kg == null ? null : dec(body.target_weight_kg),
    rateKgPerWeek: body.rate_kg_per_week == null ? null : dec(body.rate_kg_per_week),
    effectiveFrom: refDate,
    createdAt: refDate,
    updatedAt: refDate,
  };
  return computeEngine({ profile, weightRow, targetRow: draftRow, recent, refDate });
}

/** POST /target/suggest — propose a range from burn − desired deficit. Never writes.
 * Returns null when there is no weigh-in yet (burn is not computable). */
export async function suggest(
  userId: string,
  desiredDeficit: number,
): Promise<SuggestTargetResponse | null> {
  const refDate = new Date();
  const profile = await profileRepo.get(userId);
  const weightRow = await weightRepo.latestAsOf(userId, refDate);
  if (!profile || !weightRow) return null;
  const bmr = mifflinStJeor({
    weightKg: num(weightRow.weightKg),
    heightCm: num(profile.heightCm),
    ageYears: ageYears(profile.birthdate, refDate),
    sex: profile.sex as Sex,
  });
  const burn = estimatedBurn(bmr, (await recentActivity(userId)).multiplier);
  const range = suggestRange(burn, desiredDeficit);
  return { calorie_min: range.calorieMin, calorie_max: range.calorieMax };
}
