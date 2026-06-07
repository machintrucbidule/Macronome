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

  /** All of the user's target versions, newest effective date first (history list). */
  list(userId: string): Promise<TargetModel[]> {
    return prisma.target.findMany({ where: { userId }, orderBy: { effectiveFrom: 'desc' } });
  },

  /** One target version by id, user-scoped (null when another tenant's or absent). */
  findById(userId: string, id: string): Promise<TargetModel | null> {
    return prisma.target.findFirst({ where: { id, userId } });
  },

  /** The version occupying an effective date (one per date), or null — collision probe. */
  findByEffectiveFrom(userId: string, effectiveFrom: Date): Promise<TargetModel | null> {
    return prisma.target.findFirst({ where: { userId, effectiveFrom } });
  },

  /** Patch a version, user-scoped. Returns the updated row, or null when not found. */
  async update(
    userId: string,
    id: string,
    data: Partial<TargetWriteData>,
  ): Promise<TargetModel | null> {
    const result = await prisma.target.updateMany({ where: { id, userId }, data });
    return result.count > 0 ? this.findById(userId, id) : null;
  },

  /** Delete a version, user-scoped. Returns true when a row was removed. */
  async remove(userId: string, id: string): Promise<boolean> {
    const result = await prisma.target.deleteMany({ where: { id, userId } });
    return result.count > 0;
  },
};
