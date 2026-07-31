import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Repository for app_user. Auth lookups (by username / id) are the bootstrap path;
// user-owned resource repositories (later milestones) always take an explicit userId.
export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  settings: unknown;
  isAdmin: boolean;
}

export interface NewUser {
  username: string;
  passwordHash: string;
  sex: string;
  birthdate: Date;
  heightCm: number;
  isAdmin?: boolean;
}

const SELECT = {
  id: true,
  username: true,
  passwordHash: true,
  settings: true,
  isAdmin: true,
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
        isAdmin: user.isAdmin ?? false,
      },
      select: { id: true },
    });
  },

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma.appUser.update({ where: { id }, data: { passwordHash } });
  },

  /** Stamp a successful login — login screen or first-run setup (B-190). */
  async recordLogin(id: string): Promise<void> {
    const now = new Date();
    await prisma.appUser.update({
      where: { id },
      data: { lastLoginAt: now, lastSeenAt: now },
    });
  },

  /** Revoke every session of an account (rows in connect-pg-simple's table —
   *  not a Prisma model; userId lives in the sess JSON). Used by the admin
   *  delete (B-192) and the password reset (B-194). */
  async revokeAllSessions(id: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM "session" WHERE "sess"->>'userId' = ${id}`;
  },

  /** Refresh last_seen_at on authenticated activity; the SQL guard throttles to
   *  one write per 5 minutes per user (B-190; narrowed from an hour by B-239, whose
   *  staleness made the Utilisateurs stamp look frozen). Raw so updated_at is not
   *  bumped. */
  async recordActivity(id: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "app_user" SET "last_seen_at" = now()
      WHERE "id" = ${id}::uuid
        AND ("last_seen_at" IS NULL OR "last_seen_at" < now() - interval '5 minutes')`;
  },

  /** Replace the whole settings JSON blob (the service merges before calling). */
  async updateSettings(id: string, settings: Prisma.InputJsonValue): Promise<void> {
    await prisma.appUser.update({ where: { id }, data: { settings } });
  },

  /** Users who opted into the Google Drive backup (settings.integrations.google_drive
   *  .enabled = true) — the scheduler's per-tick candidate list (B-208). */
  findBackupCandidates(): Promise<{ id: string }[]> {
    return prisma.appUser.findMany({
      where: { settings: { path: ['integrations', 'google_drive', 'enabled'], equals: true } },
      select: { id: true },
    });
  },
};
