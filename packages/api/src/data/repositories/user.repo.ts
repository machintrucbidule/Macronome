import { prisma } from '../prisma.js';

// Repository for app_user. Auth lookups (by username / id) are the bootstrap path;
// user-owned resource repositories (later milestones) always take an explicit userId.
export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  settings: unknown;
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

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma.appUser.update({ where: { id }, data: { passwordHash } });
  },
};
