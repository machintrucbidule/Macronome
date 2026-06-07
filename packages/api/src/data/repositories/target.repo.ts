import type { Target as TargetModel } from '@prisma/client';
import { prisma } from '../prisma.js';

// Repository for the `target` table. Every method is scoped by the authenticated
// `userId` (CLAUDE.md rule 3). No business logic here — the service derives the engine
// readout and shapes the DTO. Saving a target upserts on (user_id, effective_from):
// re-saving for the same effective date replaces that row, keeping one target per date.

export interface TargetWriteData {
  calorieMin: number;
  calorieMax: number;
  proteinGPerKg: number;
  fatGPerKg: number;
  targetWeightKg: number | null;
  rateKgPerWeek: number | null;
  effectiveFrom: Date;
}

export const targetRepo = {
  /**
   * The target in effect as of `date`: the latest `effective_from ≤ date`. When `date`
   * precedes every target, the **earliest** target applies (it is retroactive to all dates
   * before its own `effective_from` — B-090 / `day-snapshot-verdict.md §2`), so a range is
   * null only when the user has no target at all.
   */
  async currentAsOf(userId: string, date: Date): Promise<TargetModel | null> {
    const inEffect = await prisma.target.findFirst({
      where: { userId, effectiveFrom: { lte: date } },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (inEffect) return inEffect;
    return prisma.target.findFirst({
      where: { userId },
      orderBy: { effectiveFrom: 'asc' },
    });
  },

  /** Insert (or replace, on a same-date collision) a target row for the user. */
  create(userId: string, data: TargetWriteData): Promise<TargetModel> {
    const { effectiveFrom, ...rest } = data;
    return prisma.target.upsert({
      where: { userId_effectiveFrom: { userId, effectiveFrom } },
      create: { userId, effectiveFrom, ...rest },
      update: rest,
    });
  },
};
