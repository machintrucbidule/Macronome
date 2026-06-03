import type { WeightEntry as WeightEntryModel } from '@prisma/client';
import { prisma } from '../prisma.js';

// Minimal repository for `weight_entry` — M2 only needs the current weight (latest
// weigh-in ≤ a reference date) so the metabolic engine can compute floors/BMR. The
// full weigh-in CRUD, period derivation, EMA and trajectory are added in M4 on top of
// this same table. User-scoped (CLAUDE.md rule 3).

export const weightRepo = {
  /** Most recent weigh-in dated ≤ `date`, or null when the user has none yet. */
  latestAsOf(userId: string, date: Date): Promise<WeightEntryModel | null> {
    return prisma.weightEntry.findFirst({
      where: { userId, date: { lte: date } },
      orderBy: { date: 'desc' },
    });
  },
};
