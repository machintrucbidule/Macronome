import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { toDate } from './day-read.repo.js';

// Undo points for the destructive day actions (B-261). At most one row per (user, date): a
// capture upserts, an undo reads then deletes. Every method takes the authenticated userId —
// a point is never reachable across tenants (CLAUDE.md rule 3). The replay itself belongs to
// dayCopyRepo; this repo only stores and hands back the payload.

/** Which action wrote the point — drives the confirmation copy the client shows. */
export type RestoreAction = 'clear' | 'copy' | 'delete_meal';

export interface RestorePointRow {
  action: RestoreAction;
  payload: unknown;
}

export const dayRestoreRepo = {
  /** Overwrite this day's point (there is only ever one — undo is single-level). */
  async save(
    userId: string,
    date: string,
    action: RestoreAction,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await prisma.dayRestorePoint.upsert({
      where: { userId_date: { userId, date: toDate(date) } },
      create: { userId, date: toDate(date), action, payload },
      update: { action, payload },
    });
  },

  /** The day's point, or null when none was ever captured / it was already consumed. */
  async find(userId: string, date: string): Promise<RestorePointRow | null> {
    const row = await prisma.dayRestorePoint.findFirst({
      where: { userId, date: toDate(date) },
      select: { action: true, payload: true },
    });
    return row === null ? null : { action: row.action as RestoreAction, payload: row.payload };
  },

  /** Consume the point. Undo is single-level, so a restore always clears it. */
  async remove(userId: string, date: string): Promise<void> {
    await prisma.dayRestorePoint.deleteMany({ where: { userId, date: toDate(date) } });
  },

  /** Remove the day itself — the undo of an action captured on a date that had no day_log.
   *  Meals/entries/leftovers cascade (migration SQL). */
  async removeDay(userId: string, date: string): Promise<void> {
    await prisma.dayLog.deleteMany({ where: { userId, date: toDate(date) } });
  },
};
