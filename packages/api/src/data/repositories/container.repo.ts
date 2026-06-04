import type { Container as ContainerModel } from '@prisma/client';
import { prisma } from '../prisma.js';

// Minimal read-only repository for `container`. M3 needs only to resolve a container by
// id so the leftover service can FREEZE its name + tare at apply time; the full
// Contenants CRUD/screen is built in M7. User-scoped (CLAUDE.md rule 3): a cross-tenant
// id resolves to null → 404 at the controller.

export const containerRepo = {
  /** The user's container by id, or null (not found / not owned). */
  findById(userId: string, id: string): Promise<ContainerModel | null> {
    return prisma.container.findFirst({ where: { id, ownerId: userId } });
  },
};
