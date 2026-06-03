import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Repository for the metabolic-profile slice of `app_user` (sex, birthdate, height).
// Edited on the Cibles screen; feeds the engine. Always scoped to the authenticated
// user. Age is never stored (derived by the domain).

export interface ProfileRow {
  sex: string;
  birthdate: Date;
  heightCm: Prisma.Decimal;
}

const SELECT = { sex: true, birthdate: true, heightCm: true } as const;

export interface ProfilePatch {
  sex?: string;
  birthdate?: Date;
  heightCm?: number;
}

export const profileRepo = {
  get(userId: string): Promise<ProfileRow | null> {
    return prisma.appUser.findUnique({ where: { id: userId }, select: SELECT });
  },

  update(userId: string, patch: ProfilePatch): Promise<ProfileRow> {
    return prisma.appUser.update({ where: { id: userId }, data: patch, select: SELECT });
  },
};
