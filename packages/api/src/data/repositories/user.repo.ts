import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Repository for app_user. Auth lookups (by username / id) are the bootstrap path;
// user-owned resource repositories (later milestones) always take an explicit userId.
export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  settings: unknown;
}

export interface NewUser {
  username: string;
  passwordHash: string;
  sex: string;
  birthdate: Date;
  heightCm: number;
}

const SELECT = {
  id: true,
  username: true,
  passwordHash: true,
  settings: true,
} as const;

export const userRepo = {
  findByUsername(username: string): Promise<UserRow | null> {
    return prisma.appUser.findUnique({ where: { username }, select: SELECT });
  },

  findById(id: string): Promise<UserRow | null> {
    return prisma.appUser.findUnique({ where: { id }, select: SELECT });
  },

  /** Total accounts. Drives the first-run gate (setup is allowed only at 0). */
  count(): Promise<number> {
    return prisma.appUser.count();
  },

  /** Create the single owner account (first-run setup); username stored lowercased. */
  create(user: NewUser): Promise<{ id: string }> {
    return prisma.appUser.create({
      data: {
        username: user.username.toLowerCase(),
        passwordHash: user.passwordHash,
        sex: user.sex,
        birthdate: user.birthdate,
        heightCm: user.heightCm,
      },
      select: { id: true },
    });
  },

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma.appUser.update({ where: { id }, data: { passwordHash } });
  },

  /** Replace the whole settings JSON blob (the service merges before calling). */
  async updateSettings(id: string, settings: Prisma.InputJsonValue): Promise<void> {
    await prisma.appUser.update({ where: { id }, data: { settings } });
  },
};
