import { profileRepo, type ProfileRow } from '../data/repositories/profile.repo.js';
import { targetRepo } from '../data/repositories/target.repo.js';
import { weightRepo } from '../data/repositories/weight.repo.js';
import { toDate } from '../data/repositories/day-read.repo.js';
import { ageYears } from '../domain/metabolic/index.js';
import { resolveSnapshot, type ResolvedSnapshot } from '../domain/day-verdict/index.js';

// Shared day helpers: the live target snapshot for a date, the day's profile/weight/age
// context (for the burn constat), and the date comparisons that drive the snapshot
// freezing rule (live while date==today, frozen once date<today — OPEN_GAPS #1).

const num = (d: { toString(): string }): number => Number(d.toString());

/** Today as YYYY-MM-DD (UTC, to match the midnight-UTC DATE columns). */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isPast(date: string): boolean {
  return date < todayString();
}

/** A planned/future date (strictly after today) — drives the day-state derivation (§8). */
export function isFuture(date: string): boolean {
  return date > todayString();
}

export interface DayContext {
  profile: ProfileRow;
  weightKg: number | null;
  ageOnDay: number;
}

/** Profile + body weight in effect on the date + age on that date (for the constat). */
export async function loadDayContext(userId: string, date: string): Promise<DayContext> {
  const profile = await profileRepo.get(userId);
  if (!profile) throw new Error('profile_missing'); // an authed user always has one
  const weightRow = await weightRepo.latestAsOf(userId, toDate(date));
  return {
    profile,
    weightKg: weightRow === null ? null : num(weightRow.weightKg),
    ageOnDay: ageYears(profile.birthdate, toDate(date)),
  };
}

/** The target snapshot in effect on `date` (that date's target + body weight). */
export async function resolveSnapshotForDate(
  userId: string,
  date: string,
): Promise<ResolvedSnapshot> {
  const refDate = toDate(date);
  const [targetRow, weightRow] = await Promise.all([
    targetRepo.currentAsOf(userId, refDate),
    weightRepo.latestAsOf(userId, refDate),
  ]);
  return resolveSnapshot({
    target: targetRow
      ? {
          calorieMin: targetRow.calorieMin,
          calorieMax: targetRow.calorieMax,
          proteinGPerKg: num(targetRow.proteinGPerKg),
          fatGPerKg: num(targetRow.fatGPerKg),
        }
      : null,
    weightKg: weightRow === null ? null : num(weightRow.weightKg),
  });
}
