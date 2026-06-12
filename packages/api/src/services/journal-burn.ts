import type { WeightEntry as WeightEntryModel } from '@prisma/client';
import { ACTIVITY_MULTIPLIERS, type ActivityLevel, type Sex } from '@macronome/shared';
import { profileRepo, type ProfileRow } from '../data/repositories/profile.repo.js';
import { weightRepo } from '../data/repositories/weight.repo.js';
import { toDate } from '../data/repositories/day-read.repo.js';
import {
  ageYears,
  deficitPerDay,
  estimatedBurn,
  mifflinStJeor,
} from '../domain/metabolic/index.js';

// Per-day burn écart for the Journal (B-163): the signed `kcal − estimated_burn` shown beside the
// activity selector — the same per-day deficit as the Repas constat (spec/logic/day-snapshot-verdict.md
// §7, metabolic-engine.md §5). Computed server-side (CLAUDE.md rule 2). The Journal does not load
// per-day context, so the profile + the full weigh-in series are batch-loaded ONCE and the latest
// weight as-of each day is resolved in memory (no N+1).

const num = (d: { toString(): string }): number => Number(d.toString());

export interface BurnContext {
  profile: ProfileRow | null;
  /** All weigh-ins, oldest first (weightRepo.findAll order). */
  weights: WeightEntryModel[];
}

/** Load once the profile + the full weigh-in series the per-day burn needs. */
export async function loadBurnContext(userId: string): Promise<BurnContext> {
  const [profile, weights] = await Promise.all([
    profileRepo.get(userId),
    weightRepo.findAll(userId),
  ]);
  return { profile, weights };
}

/** The most recent weigh-in dated ≤ `date` (kg), or null when none precedes it. The series is
 *  oldest-first, so we scan from the end and take the first one on/before the date. */
function weightAsOf(weights: WeightEntryModel[], date: Date): number | null {
  for (let i = weights.length - 1; i >= 0; i -= 1) {
    if (weights[i]!.date <= date) return num(weights[i]!.weightKg);
  }
  return null;
}

/** Signed kcal écart vs the day's estimated expenditure (`kcal − estimated_burn`), or null when
 *  no profile or no weigh-in on/before the date (no expenditure). Reuses the metabolic domain. */
export function burnGapFor(
  ctx: BurnContext,
  date: string,
  activityLevel: string,
  kcal: number,
): number | null {
  if (!ctx.profile) return null;
  const refDate = toDate(date);
  const weightKg = weightAsOf(ctx.weights, refDate);
  if (weightKg === null) return null;
  const bmr = mifflinStJeor({
    weightKg,
    heightCm: num(ctx.profile.heightCm),
    ageYears: ageYears(ctx.profile.birthdate, refDate),
    sex: ctx.profile.sex as Sex,
  });
  const burn = estimatedBurn(bmr, ACTIVITY_MULTIPLIERS[activityLevel as ActivityLevel]);
  return deficitPerDay(kcal, burn);
}
