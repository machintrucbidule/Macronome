import { prisma } from '../prisma.js';

// Single-use link tokens (spec/schema §account_token, B-193/B-194). Only the
// sha256 of the raw token is stored; consumption/revocation DELETE the row.
// Admin-scoped resource (behind requireAdmin), so no per-user scoping here —
// except the reset-target queries, which take the explicit userId.

export interface AccountTokenRow {
  id: string;
  kind: string;
  tokenHash: string;
  isAdmin: boolean;
  userId: string | null;
  expiresAt: Date;
  createdAt: Date;
}

const SELECT = {
  id: true,
  kind: true,
  tokenHash: true,
  isAdmin: true,
  userId: true,
  expiresAt: true,
  createdAt: true,
} as const;

export const accountTokenRepo = {
  create(data: {
    kind: 'invite' | 'password_reset';
    tokenHash: string;
    isAdmin: boolean;
    userId: string | null;
    expiresAt: Date;
  }): Promise<AccountTokenRow> {
    return prisma.accountToken.create({ data, select: SELECT });
  },

  findByHash(tokenHash: string): Promise<AccountTokenRow | null> {
    return prisma.accountToken.findUnique({ where: { tokenHash }, select: SELECT });
  },

  listAll(): Promise<AccountTokenRow[]> {
    return prisma.accountToken.findMany({ select: SELECT, orderBy: { createdAt: 'asc' } });
  },

  /** Usernames for the reset targets in a listing (no Prisma relation — FK is SQL-only). */
  async usernamesByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.appUser.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true },
    });
    return new Map(rows.map((r) => [r.id, r.username]));
  },

  /** Delete (consume / revoke); true when a row was actually removed. */
  async deleteById(id: string): Promise<boolean> {
    const { count } = await prisma.accountToken.deleteMany({ where: { id } });
    return count === 1;
  },

  /** At most one pending reset link per account (owner decision) — clear before create. */
  async deleteResetTokensFor(userId: string): Promise<void> {
    await prisma.accountToken.deleteMany({ where: { kind: 'password_reset', userId } });
  },

  async purgeExpired(now: Date): Promise<void> {
    await prisma.accountToken.deleteMany({ where: { expiresAt: { lt: now } } });
  },
};
