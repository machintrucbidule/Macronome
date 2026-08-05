import type { Prisma } from '@prisma/client';
import { dayReadRepo } from '../data/repositories/day-read.repo.js';
import { dayRestoreRepo, type RestoreAction } from '../data/repositories/day-restore.repo.js';
import type { CopyMealData } from '../data/repositories/day-copy.repo.js';
import { planMeals } from './day-plan.js';

// Capture half of the day undo (B-261). Deliberately split from `day-restore.ts`: the restore
// needs `days.get()` to answer, while the capture is called BY `days.ts` / `day-copy.ts` /
// `meals.ts` — keeping them in one module would make that import chain circular.

/** The stored snapshot of a day, in the shape `dayCopyRepo.copyInto` replays. */
export interface RestorePayload {
  /** False when the date carried no day_log: undoing then removes the day again. */
  existed: boolean;
  kind: 'detailed' | 'summary';
  summaryKcal: number | null;
  comment: string | null;
  activityLevel: string;
  verdictOverride: string | null;
  verdictAuto: string | null;
  /** The day's own target snapshot at capture time — restored verbatim, so a past (frozen)
   *  day comes back with the exact band it was judged against (CLAUDE.md rule 4). */
  targetSnapshot: unknown;
  meals: CopyMealData[];
}

const num = (d: { toString(): string }): number => Number(d.toString());

/** Overwrite this day's undo point with its current content, just before a destructive write.
 *  Never throws on a missing day — "the day did not exist" is itself a restorable state. */
export async function captureRestorePoint(
  userId: string,
  date: string,
  action: RestoreAction,
): Promise<void> {
  const aggregate = await dayReadRepo.readAggregate(userId, date);
  const payload: RestorePayload = aggregate
    ? {
        existed: true,
        kind: aggregate.dayLog.kind as 'detailed' | 'summary',
        summaryKcal:
          aggregate.dayLog.summaryKcal === null ? null : num(aggregate.dayLog.summaryKcal),
        comment: aggregate.dayLog.comment,
        activityLevel: aggregate.dayLog.activityLevel,
        verdictOverride: aggregate.dayLog.verdictOverride,
        verdictAuto: aggregate.dayLog.verdictAuto,
        targetSnapshot: aggregate.dayLog.targetSnapshot,
        meals: planMeals(aggregate),
      }
    : {
        existed: false,
        kind: 'detailed',
        summaryKcal: null,
        comment: null,
        activityLevel: '',
        verdictOverride: null,
        verdictAuto: null,
        targetSnapshot: null,
        meals: [],
      };
  await dayRestoreRepo.save(userId, date, action, payload as unknown as Prisma.InputJsonValue);
}
