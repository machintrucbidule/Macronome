import type { RecomputeTargetRequest } from '@macronome/shared';
import type { Prisma, Target as TargetModel } from '@prisma/client';
import { dayReadRepo, toDate } from '../data/repositories/day-read.repo.js';
import { dayRepo } from '../data/repositories/day.repo.js';
import { dayStatRepo } from '../data/repositories/day-stat.repo.js';
import { targetRepo } from '../data/repositories/target.repo.js';
import { autoVerdict, type ResolvedSnapshot } from '../domain/day-verdict/index.js';
import { resolveSnapshotForDate } from './day-context.js';
import { dayStat } from './day-stat.js';

// Opt-in, auto-only recompute (TH-1 / B-091; day-snapshot-verdict.md §3). It re-freezes
// target_snapshot + recomputes verdict_auto for logged days WITH NO override in a target
// version's affected window — the single sanctioned exception to the freeze rule
// (CLAUDE.md rule 4). Forced/overridden days and out-of-window days are never touched.
// The default window is the version's own period; explicit from/to widen it to cover an
// effective_from edit's union span. Per day the snapshot is re-derived via
// resolveSnapshotForDate, so each day re-freezes against whatever version now governs it.

const asJson = (s: ResolvedSnapshot): Prisma.InputJsonValue =>
  s as unknown as Prisma.InputJsonValue;
const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

/** The day before a UTC-midnight date, as YYYY-MM-DD. */
function dayBefore(date: Date): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return toDateString(d);
}

interface AffectedDay {
  date: string;
  kcal: number;
}

/** A version's natural recompute window [from, to] (inclusive YYYY-MM-DD), or nulls when
 * there are no logged days to bound it. The earliest version is retroactive to all prior
 * logged days (VR-1/B-090), so its window starts at the first logged day; otherwise it
 * starts at the version's own effective date. It ends the day before the next version, or
 * at the last logged day for the current version. */
async function naturalWindow(
  userId: string,
  version: TargetModel,
  allAsc: TargetModel[],
): Promise<{ from: string | null; to: string | null }> {
  const idx = allAsc.findIndex((r) => r.id === version.id);
  const next = allAsc[idx + 1]; // the version with the next-greater effective_from, if any
  const [{ minDate }, latest] = await Promise.all([
    dayReadRepo.yearRange(userId),
    dayStatRepo.latestDate(userId),
  ]);
  const from = idx === 0 ? minDate : toDateString(version.effectiveFrom);
  const to = next ? dayBefore(next.effectiveFrom) : latest ? toDateString(latest) : null;
  return { from, to };
}

/** The logged, non-overridden days a recompute of `version` would touch, with their kcal. */
async function affectedDays(
  userId: string,
  version: TargetModel,
  overrides?: RecomputeTargetRequest,
): Promise<AffectedDay[]> {
  const allAsc = (await targetRepo.list(userId)).slice().reverse();
  const nat = await naturalWindow(userId, version, allAsc);
  const from = overrides?.from ?? nat.from;
  const to = overrides?.to ?? nat.to;
  if (from === null || to === null || from > to) return [];
  const lightDays = await dayStatRepo.readLightweight(userId, {
    from: toDate(from),
    to: toDate(to),
  });
  const out: AffectedDay[] = [];
  for (const d of lightDays) {
    if (d.verdictOverride !== null) continue; // forced/overridden days untouched
    const s = dayStat(d); // null when the day carries no calorie value (not logged)
    if (s === null) continue;
    out.push({ date: d.date, kcal: s.kcal });
  }
  return out;
}

/** POST /targets/:id/recompute — re-freeze + re-verdict the affected window. Returns the
 * count of recomputed days, or null when the version is absent/another tenant's (→ 404). */
export async function recompute(
  userId: string,
  id: string,
  overrides?: RecomputeTargetRequest,
): Promise<number | null> {
  const version = await targetRepo.findById(userId, id);
  if (!version) return null;
  const affected = await affectedDays(userId, version, overrides);
  for (const a of affected) {
    const snap = await resolveSnapshotForDate(userId, a.date);
    const verdict = autoVerdict(a.kcal, snap.cal_min, snap.cal_max);
    await dayRepo.updateDay(userId, a.date, { targetSnapshot: asJson(snap), verdictAuto: verdict });
  }
  return affected.length;
}

/** GET /targets/:id/recompute-count — how many days the recompute would touch (button
 * label), or null when the version is absent/another tenant's (→ 404). */
export async function recomputeCount(userId: string, id: string): Promise<number | null> {
  const version = await targetRepo.findById(userId, id);
  if (!version) return null;
  return (await affectedDays(userId, version)).length;
}
