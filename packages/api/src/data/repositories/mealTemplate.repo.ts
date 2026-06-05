import type { MealSlotTemplate as MealTemplateModel } from '@prisma/client';
import { prisma } from '../prisma.js';

// Repository for `meal_slot_template` (the user's default day structure). User-scoped
// (CLAUDE.md rule 3): a cross-tenant id resolves to null → 404 at the controller. No
// business logic here — the service owns ordering and the day-seeding read.

export interface MealTemplateWriteData {
  name: string;
  orderIndex: number;
}

export const mealTemplateRepo = {
  /** The user's template slots in display order. */
  list(userId: string): Promise<MealTemplateModel[]> {
    return prisma.mealSlotTemplate.findMany({
      where: { userId },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    });
  },

  /** The slot if it belongs to the user, else null (tenancy 404). */
  findOwned(userId: string, id: string): Promise<MealTemplateModel | null> {
    return prisma.mealSlotTemplate.findFirst({ where: { id, userId } });
  },

  /** Next order_index for the user's template (append at the end). */
  async nextOrderIndex(userId: string): Promise<number> {
    const last = await prisma.mealSlotTemplate.findFirst({
      where: { userId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return (last?.orderIndex ?? -1) + 1;
  },

  create(userId: string, data: MealTemplateWriteData): Promise<MealTemplateModel> {
    return prisma.mealSlotTemplate.create({ data: { userId, ...data } });
  },

  update(id: string, data: Partial<MealTemplateWriteData>): Promise<MealTemplateModel> {
    return prisma.mealSlotTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.orderIndex !== undefined ? { orderIndex: data.orderIndex } : {}),
      },
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.mealSlotTemplate.delete({ where: { id } });
  },

  /** Seed several slots in one call (bootstrap). Skips when the user already has any. */
  async seedDefaults(userId: string, names: string[]): Promise<void> {
    const existing = await prisma.mealSlotTemplate.count({ where: { userId } });
    if (existing > 0) return;
    await prisma.mealSlotTemplate.createMany({
      data: names.map((name, orderIndex) => ({ userId, name, orderIndex })),
    });
  },
};
