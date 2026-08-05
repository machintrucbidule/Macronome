import type { DayDetail } from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import type { Prisma } from '@prisma/client';
import { dayCopyRepo } from '../data/repositories/day-copy.repo.js';
import { dayRestoreRepo } from '../data/repositories/day-restore.repo.js';
import { dayRepo } from '../data/repositories/day.repo.js';
import { ApiError } from '../http/errors.js';
import type { RestorePayload } from './day-restore-capture.js';
import { get } from './days.js';

// POST /days/:date/undo (B-261) — replay the day's restore point. The replay goes through the
// SAME transactional rebuild as /copy-from (dayCopyRepo.copyInto), which is what makes it
// faithful: entries keep their frozen macro snapshots and per-line garde-manger flag, and
// leftover groups come back with their already-frozen container_name + tare_g. A browser-side
// replay could not do that — the catalog container id is not part of the stored history.
//
// Undo is single-level: the point is consumed on success, so a second call is 409.

/** POST /days/:date/undo — restore the state preceding the last destructive action. */
export async function restoreDay(userId: string, date: string): Promise<DayDetail> {
  const point = await dayRestoreRepo.find(userId, date);
  if (point === null) throw new ApiError(409, ErrorCode.NothingToUndo);
  const payload = point.payload as RestorePayload;

  if (!payload.existed) {
    // The action ran on a date that carried no day_log — undoing removes it again.
    await dayRestoreRepo.removeDay(userId, date);
    await dayRestoreRepo.remove(userId, date);
    return get(userId, date); // an unsaved scaffold, exactly as before the action
  }

  await dayCopyRepo.copyInto(userId, date, {
    kind: payload.kind,
    summaryKcal: payload.summaryKcal,
    verdictAuto: payload.verdictAuto as 'OK' | 'NOK' | null,
    targetSnapshot: payload.targetSnapshot as Prisma.InputJsonValue,
    meals: payload.meals,
  });
  // copyInto carries the day's content but not its three day-level fields (it deliberately
  // keeps the target's own comment/activity and resets the override) — restore them here.
  await dayRepo.updateDay(userId, date, {
    comment: payload.comment,
    activityLevel: payload.activityLevel,
    verdictOverride: payload.verdictOverride as 'OK' | 'NOK' | null,
  });
  await dayRestoreRepo.remove(userId, date);
  return get(userId, date);
}
