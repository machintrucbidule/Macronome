import type { WeightEntry as WeightEntryModel } from '@prisma/client';
import { prisma } from '../prisma.js';
import { toDate } from './day-read.repo.js';

// Repository for `weight_entry`. M2 added `latestAsOf` (current weight for the metabolic
// engine); M4 adds the full weigh-in CRUD that the Weight screen needs — period
// derivation, EMA and trajectory are derived in the service from `findAll`. Every method
// is scoped by the authenticated `userId` (CLAUDE.md rule 3); cross-tenant ids resolve to
// null/0 so the controller can answer 404. No business logic here.

export interface WeightWriteData {
  date: Date;
  weightKg: number;
  waistCm: number | null;
  dietFlag: string;
  note: string | null;
}

export const weightRepo = {
  /** Most recent weigh-in dated ≤ `date`, or null when the user has none yet. */
  latestAsOf(userId: string, date: Date): Promise<WeightEntryModel | null> {
    return prisma.weightEntry.findFirst({
      where: { userId, date: { lte: date } },
      orderBy: { date: 'desc' },
    });
  },

  /** All of the user's weigh-ins, oldest first (the series EMA/trajectory build on). */
  findAll(userId: string): Promise<WeightEntryModel[]> {
    return prisma.weightEntry.findMany({ where: { userId }, orderBy: { date: 'asc' } });
  },

  /** One weigh-in by id, user-scoped (null when it is another tenant's or absent). */
  findById(userId: string, id: string): Promise<WeightEntryModel | null> {
    return prisma.weightEntry.findFirst({ where: { id, userId } });
  },

  /** The weigh-in occupying a date (one per day), or null. */
  findByDate(userId: string, date: string): Promise<WeightEntryModel | null> {
    return prisma.weightEntry.findFirst({ where: { userId, date: toDate(date) } });
  },

  /** Insert a weigh-in (the service guards the one-per-day rule before calling). */
  create(userId: string, data: WeightWriteData): Promise<WeightEntryModel> {
    return prisma.weightEntry.create({ data: { userId, ...data } });
  },

  /** Patch a weigh-in, user-scoped. Returns the updated row, or null when not found. */
  async update(
    userId: string,
    id: string,
    data: Partial<WeightWriteData>,
  ): Promise<WeightEntryModel | null> {
    const result = await prisma.weightEntry.updateMany({ where: { id, userId }, data });
    return result.count > 0 ? this.findById(userId, id) : null;
  },

  /** Delete a weigh-in, user-scoped. Returns true when a row was removed. */
  async remove(userId: string, id: string): Promise<boolean> {
    const result = await prisma.weightEntry.deleteMany({ where: { id, userId } });
    return result.count > 0;
  },
};
