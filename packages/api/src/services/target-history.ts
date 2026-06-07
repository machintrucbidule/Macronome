import type {
  GetTargetHistoryResponse,
  PatchTargetRequest,
  TargetVersion,
} from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import type { Target as TargetModel } from '@prisma/client';
import { toDate } from '../data/repositories/day-read.repo.js';
import { targetRepo, type TargetWriteData } from '../data/repositories/target.repo.js';
import { ApiError } from '../http/errors.js';
import { targetToListItemDto } from './target-engine.js';

// Target-history orchestration (TH-1 / B-091): list every version with its period end,
// edit any version (including its effective date, back-datable), and delete one. Targets
// are versioned by effective_from (UNIQUE(user_id, effective_from)); only the read/edit
// surface was missing (spec/api/weight-targets-stats-settings.md §Targets, DECISIONS TH-1).
// User-scoped throughout (CLAUDE.md rule 3); recompute of frozen days is a separate,
// explicit opt-in (target-recompute.ts).

const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

/** The day before a UTC-midnight date, as YYYY-MM-DD (a version's period end). */
function dayBefore(date: Date): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return toDateString(d);
}

/** Map the user's versions (newest effective_from first) to history DTOs with their
 * period end: a row's period ends the day before the next (newer) version; the newest
 * version is still current (until = null). */
function toVersions(rows: TargetModel[]): TargetVersion[] {
  return rows.map((row, i) =>
    targetToListItemDto(row, i === 0 ? null : dayBefore(rows[i - 1]!.effectiveFrom)),
  );
}

/** GET /targets — all versions, newest first, each with its period end. */
export async function list(userId: string): Promise<GetTargetHistoryResponse> {
  return { versions: toVersions(await targetRepo.list(userId)) };
}

/** Build the partial write data from a patch body (snake → camel; only provided fields). */
function partialWriteData(body: PatchTargetRequest): Partial<TargetWriteData> {
  const data: Partial<TargetWriteData> = {};
  if (body.calorie_min !== undefined) data.calorieMin = body.calorie_min;
  if (body.calorie_max !== undefined) data.calorieMax = body.calorie_max;
  if (body.protein_g_per_kg !== undefined) data.proteinGPerKg = body.protein_g_per_kg;
  if (body.fat_g_per_kg !== undefined) data.fatGPerKg = body.fat_g_per_kg;
  if (body.target_weight_kg !== undefined) data.targetWeightKg = body.target_weight_kg ?? null;
  if (body.rate_kg_per_week !== undefined) data.rateKgPerWeek = body.rate_kg_per_week ?? null;
  if (body.effective_from !== undefined) data.effectiveFrom = toDate(body.effective_from);
  return data;
}

/** PATCH /targets/:id — edit a version (incl. effective_from). Returns the updated version
 * (with its recomputed period end), or null when absent/another tenant's (→ 404). Moving
 * onto another version's date → 409 target_date_occupied; a merged calorie_max < min → 422. */
export async function patch(
  userId: string,
  id: string,
  body: PatchTargetRequest,
): Promise<TargetVersion | null> {
  const existing = await targetRepo.findById(userId, id);
  if (!existing) return null;
  if (body.effective_from !== undefined) {
    const other = await targetRepo.findByEffectiveFrom(userId, toDate(body.effective_from));
    if (other && other.id !== id) {
      throw new ApiError(409, ErrorCode.TargetDateOccupied, { existing_id: other.id });
    }
  }
  // Cross-field min ≤ max on the MERGED row (the schema refine only fires when both are
  // present in the patch; a patch touching only one bound is checked here).
  const mergedMin = body.calorie_min ?? existing.calorieMin;
  const mergedMax = body.calorie_max ?? existing.calorieMax;
  if (mergedMax < mergedMin) {
    throw new ApiError(422, ErrorCode.ValidationError, { calorie_max: 'calorie_max_below_min' });
  }
  await targetRepo.update(userId, id, partialWriteData(body));
  return toVersions(await targetRepo.list(userId)).find((v) => v.id === id) ?? null;
}

/** DELETE /targets/:id — → true (204) / false when absent or another tenant's (→ 404). */
export function remove(userId: string, id: string): Promise<boolean> {
  return targetRepo.remove(userId, id);
}
