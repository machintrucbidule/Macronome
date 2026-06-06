import type {
  CreateTargetRequest,
  GetTargetResponse,
  PreviewTargetRequest,
  PreviewTargetResponse,
  Sex,
  SuggestTargetResponse,
} from '@macronome/shared';
import { Prisma, type Target as TargetModel } from '@prisma/client';
import { profileRepo } from '../data/repositories/profile.repo.js';
import { targetRepo } from '../data/repositories/target.repo.js';
import { weightRepo } from '../data/repositories/weight.repo.js';
import {
  ageYears,
  estimatedBurn,
  mifflinStJeor,
  recentAvgActivity,
} from '../domain/metabolic/index.js';
import { suggestRange } from '../domain/targets/index.js';
import { computeEngine, targetToDto } from './target-engine.js';

// Targets service: orchestration only (CLAUDE.md — logic lives in the domain). It reads
// the profile, current weight (latest weigh-in) and current target, then delegates the
// derivation to the pure engine. Recent-average activity needs day_log (M3); until then
// it falls back to sedentary via recentAvgActivity([]) with an insufficient-data flag.

const num = (d: { toString(): string }): number => Number(d.toString());

/** GET /target — the persisted target + live engine readout + non-blocking warnings. */
export async function get(userId: string): Promise<GetTargetResponse> {
  const refDate = new Date();
  const profile = await profileRepo.get(userId);
  if (!profile) throw new Error('profile_missing'); // an authed user always has one
  const [weightRow, targetRow] = await Promise.all([
    weightRepo.latestAsOf(userId, refDate),
    targetRepo.currentAsOf(userId, refDate),
  ]);
  const recent = recentAvgActivity([]); // M3: mean of the last ~30 logged days
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
  const refDate = new Date();
  const profile = await profileRepo.get(userId);
  if (!profile) throw new Error('profile_missing'); // an authed user always has one
  const weightRow = await weightRepo.latestAsOf(userId, refDate);
  const recent = recentAvgActivity([]); // M3: mean of the last ~30 logged days
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
  const burn = estimatedBurn(bmr, recentAvgActivity([]).multiplier);
  const range = suggestRange(burn, desiredDeficit);
  return { calorie_min: range.calorieMin, calorie_max: range.calorieMax };
}
