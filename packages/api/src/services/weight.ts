import type {
  CreateWeighInRequest,
  GetWeightResponse,
  PatchWeighInRequest,
  WeightRange,
} from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import { dayReadRepo, toDate } from '../data/repositories/day-read.repo.js';
import { profileRepo } from '../data/repositories/profile.repo.js';
import { targetRepo } from '../data/repositories/target.repo.js';
import { weightRepo, type WeightWriteData } from '../data/repositories/weight.repo.js';
import { ApiError } from '../http/errors.js';
import * as settingsService from './settings.js';
import { buildWeightView } from './weight-view.js';
import { loggedDay, type LoggedDay } from './weight-periods.js';

// Weight service (spec/api/weight-targets-stats-settings.md §Weight). Orchestration only:
// it reads the weigh-ins, profile and current target, pulls the logged days for the
// per-period intake stats, and delegates all shaping to weight-view.ts. The one-per-day
// rule is enforced here (409 weigh_in_date_occupied + existing_id); CRUD writes re-derive
// adjacent periods implicitly because periods are always derived from the full series.

const num = (d: { toString(): string }): number => Number(d.toString());

/** Read + assemble the full Weight view for the user (used by GET and after each write). */
async function readView(userId: string, range: WeightRange): Promise<GetWeightResponse> {
  const [entries, profile, target, targets, weightState] = await Promise.all([
    weightRepo.findAll(userId),
    profileRepo.get(userId),
    targetRepo.currentAsOf(userId, new Date()),
    targetRepo.list(userId),
    settingsService.weightState(userId),
  ]);
  if (!profile) throw new Error('profile_missing'); // an authed user always has one
  const today = new Date().toISOString().slice(0, 10);
  // Logged days for the per-period stats AND the open interval (last weigh-in → today): fetch
  // through today so days logged after the last weigh-in are counted (B-176).
  let loggedDays: LoggedDay[] = [];
  if (entries.length >= 1) {
    const from = entries[0]!.date.toISOString().slice(0, 10);
    const lastDate = entries[entries.length - 1]!.date.toISOString().slice(0, 10);
    const to = lastDate > today ? lastDate : today;
    loggedDays = (await dayReadRepo.readRange(userId, from, to))
      .map(loggedDay)
      .filter((d): d is LoggedDay => d !== null);
  }
  return buildWeightView({
    entries,
    profile,
    targetRates: targets.map((t) => ({
      effectiveFrom: t.effectiveFrom.toISOString().slice(0, 10),
      rateKgPerWeek: t.rateKgPerWeek != null ? num(t.rateKgPerWeek) : 0,
    })),
    goalWeight: target?.targetWeightKg != null ? num(target.targetWeightKg) : null,
    loggedDays,
    range,
    currentMode: weightState.currentMode,
    today,
    openPeriodNote: weightState.openPeriodNote,
  });
}

function writeData(body: CreateWeighInRequest): WeightWriteData {
  return {
    date: toDate(body.date),
    weightKg: body.weight_kg,
    waistCm: body.waist_cm ?? null,
    dietFlag: body.diet_flag,
    note: body.note ?? null,
  };
}

function partialWriteData(body: PatchWeighInRequest): Partial<WeightWriteData> {
  const data: Partial<WeightWriteData> = {};
  if (body.date !== undefined) data.date = toDate(body.date);
  if (body.weight_kg !== undefined) data.weightKg = body.weight_kg;
  if (body.waist_cm !== undefined) data.waistCm = body.waist_cm ?? null;
  if (body.diet_flag !== undefined) data.dietFlag = body.diet_flag;
  if (body.note !== undefined) data.note = body.note ?? null;
  return data;
}

/** GET /weight?range= — weigh-ins, EMA, trajectory, periods, cartouche, current_mode. */
export function get(userId: string, range: WeightRange): Promise<GetWeightResponse> {
  return readView(userId, range);
}

/** POST /weight — one per day; an occupied date → 409 with the existing id. → 201. */
export async function create(
  userId: string,
  body: CreateWeighInRequest,
): Promise<GetWeightResponse> {
  const occupied = await weightRepo.findByDate(userId, body.date);
  if (occupied) {
    throw new ApiError(409, ErrorCode.WeighInDateOccupied, { existing_id: occupied.id });
  }
  await weightRepo.create(userId, writeData(body));
  return readView(userId, 'all');
}

/** PATCH /weight/:id — edit (incl. date); moving onto an occupied date → 409. → 200 /
 * null when the weigh-in is absent or another tenant's (controller → 404). */
export async function patch(
  userId: string,
  id: string,
  body: PatchWeighInRequest,
): Promise<GetWeightResponse | null> {
  const existing = await weightRepo.findById(userId, id);
  if (!existing) return null;
  if (body.date !== undefined) {
    const other = await weightRepo.findByDate(userId, body.date);
    if (other && other.id !== id) {
      throw new ApiError(409, ErrorCode.WeighInDateOccupied, { existing_id: other.id });
    }
  }
  await weightRepo.update(userId, id, partialWriteData(body));
  return readView(userId, 'all');
}

/** DELETE /weight/:id — → true (204) / false when absent or another tenant's (404). */
export function remove(userId: string, id: string): Promise<boolean> {
  return weightRepo.remove(userId, id);
}
