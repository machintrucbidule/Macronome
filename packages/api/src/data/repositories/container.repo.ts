import type { Container as ContainerModel } from '@prisma/client';
import { prisma } from '../prisma.js';

// Repository for `container`. Every method is scoped by the authenticated `userId`
// (CLAUDE.md rule 3): a cross-tenant id resolves to null → 404 at the controller. The
// leftover service still freezes a container's name + tare at apply time (a delete never
// affects frozen history — DECISIONS Gap 13). No business logic here — the service guards
// the locked built-in "Rien" and computes normalized_name.

export interface ContainerWriteData {
  name: string;
  normalizedName: string;
  emptyWeightG: number;
}

export const containerRepo = {
  /** The user's container by id, or null (not found / not owned). */
  findById(userId: string, id: string): Promise<ContainerModel | null> {
    return prisma.container.findFirst({ where: { id, ownerId: userId } });
  },

  /** All the user's containers, built-in first then by name (display order). */
  list(userId: string): Promise<ContainerModel[]> {
    return prisma.container.findMany({
      where: { ownerId: userId },
      orderBy: [{ isBuiltin: 'desc' }, { name: 'asc' }],
    });
  },

  /** True if another container of the same normalized name exists for the user. */
  async existsByNormalizedName(
    userId: string,
    normalizedName: string,
    excludeId?: string,
  ): Promise<boolean> {
    const match = await prisma.container.findFirst({
      where: { ownerId: userId, normalizedName, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return match !== null;
  },

  create(userId: string, data: ContainerWriteData): Promise<ContainerModel> {
    return prisma.container.create({ data: { ownerId: userId, ...data } });
  },

  update(id: string, data: Partial<ContainerWriteData>): Promise<ContainerModel> {
    return prisma.container.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.normalizedName !== undefined ? { normalizedName: data.normalizedName } : {}),
        ...(data.emptyWeightG !== undefined ? { emptyWeightG: data.emptyWeightG } : {}),
      },
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.container.delete({ where: { id } });
  },

  /** Seed the locked built-in "Rien" if the user has none (idempotent bootstrap). */
  async ensureBuiltin(userId: string, name: string, tareG: number): Promise<void> {
    const existing = await prisma.container.findFirst({
      where: { ownerId: userId, isBuiltin: true },
      select: { id: true },
    });
    if (existing) return;
    await prisma.container.create({
      data: {
        ownerId: userId,
        name,
        normalizedName: name.toLowerCase(),
        emptyWeightG: tareG,
        isBuiltin: true,
      },
    });
  },
};
