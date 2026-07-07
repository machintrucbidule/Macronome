import type { LeftoverGroup as LeftoverGroupModel } from '@prisma/client';
import { prisma } from '../prisma.js';

// Writes for leftover_group + leftover_group_entry. Part of the day aggregate; split out
// for the 300-line rule. The container is frozen as a value (container_name + tare_g) by
// the service before this layer persists. User-scoped via meal → day_log.user_id. The
// validation/proration is the service's (domain/leftover); nothing is written on a block.

export interface LeftoverWriteData {
  containerName: string;
  tareG: number;
  grossGrams: number;
  entryIds: string[];
}

export const leftoverRepo = {
  /** The group if it belongs to the user (group → meal → day_log.user_id), else null. */
  async ownedGroup(userId: string, groupId: string): Promise<LeftoverGroupModel | null> {
    const group = await prisma.leftoverGroup.findUnique({ where: { id: groupId } });
    if (!group) return null;
    const meal = await prisma.meal.findUnique({
      where: { id: group.mealId },
      select: { dayLogId: true },
    });
    if (!meal) return null;
    const day = await prisma.dayLog.findFirst({
      where: { id: meal.dayLogId, userId },
      select: { id: true },
    });
    return day ? group : null;
  },

  /** Whether an entry is linked to any leftover group (blocks a cross-meal move, B-187). */
  async isEntryLinked(entryId: string): Promise<boolean> {
    const link = await prisma.leftoverGroupEntry.findFirst({
      where: { mealEntryId: entryId },
      select: { leftoverGroupId: true },
    });
    return link !== null;
  },

  /** The meal_entry ids currently linked to a group (for a PATCH that keeps them). */
  async entryIdsOf(groupId: string): Promise<string[]> {
    const links = await prisma.leftoverGroupEntry.findMany({
      where: { leftoverGroupId: groupId },
      select: { mealEntryId: true },
    });
    return links.map((l) => l.mealEntryId);
  },

  /** Create a group + its prorated-subset links in one transaction. */
  create(mealId: string, data: LeftoverWriteData): Promise<LeftoverGroupModel> {
    return prisma.$transaction(async (tx) => {
      const group = await tx.leftoverGroup.create({
        data: {
          mealId,
          containerName: data.containerName,
          tareG: data.tareG,
          grossGrams: data.grossGrams,
        },
      });
      await tx.leftoverGroupEntry.createMany({
        data: data.entryIds.map((id) => ({ leftoverGroupId: group.id, mealEntryId: id })),
      });
      return group;
    });
  },

  /** Replace a group's frozen values + its selected entries in one transaction. */
  update(groupId: string, data: LeftoverWriteData): Promise<LeftoverGroupModel> {
    return prisma.$transaction(async (tx) => {
      const group = await tx.leftoverGroup.update({
        where: { id: groupId },
        data: {
          containerName: data.containerName,
          tareG: data.tareG,
          grossGrams: data.grossGrams,
        },
      });
      await tx.leftoverGroupEntry.deleteMany({ where: { leftoverGroupId: groupId } });
      await tx.leftoverGroupEntry.createMany({
        data: data.entryIds.map((id) => ({ leftoverGroupId: groupId, mealEntryId: id })),
      });
      return group;
    });
  },

  async delete(userId: string, groupId: string): Promise<boolean> {
    if (!(await this.ownedGroup(userId, groupId))) return false;
    await prisma.leftoverGroup.delete({ where: { id: groupId } });
    return true;
  },
};
