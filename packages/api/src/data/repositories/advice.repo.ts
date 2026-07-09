import type { Advice as AdviceModel, Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Archived AI "Conseils" read/write layer (spec/schema/tables-catalog.md → advice, B-202). Every
// method is user-scoped (CLAUDE.md rule 3): a cross-tenant id resolves to nothing → the controller
// answers 404. `snapshot` is the compact aggregated payload that produced the advice (jsonb).

export interface AdviceWriteData {
  model: string;
  content: string;
  /** The compact aggregated payload (a JSON-serialisable object); cast to Prisma's JSON at write. */
  snapshot: unknown;
}

export const adviceRepo = {
  /** Persist one generation. Returns the created row (the controller maps it to the DTO). */
  create(userId: string, data: AdviceWriteData): Promise<AdviceModel> {
    return prisma.advice.create({
      data: {
        userId,
        model: data.model,
        content: data.content,
        snapshot: data.snapshot as Prisma.InputJsonValue,
      },
    });
  },

  /** The user's archived advices, newest first (Conseils list order, idx_advice_user_created). */
  list(userId: string): Promise<AdviceModel[]> {
    return prisma.advice.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  },

  /** Delete one; user-scoped so another tenant's id deletes nothing → `false` → 404. */
  async remove(userId: string, id: string): Promise<boolean> {
    const result = await prisma.advice.deleteMany({ where: { id, userId } });
    return result.count > 0;
  },
};
