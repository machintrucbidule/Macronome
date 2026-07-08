import { prisma } from '../prisma.js';
import { deleteAllUserData } from './data-wipe.repo.js';

// Admin-side account queries (spec/api/users-admin.md, B-192). Account metadata
// only — the password hash, settings blob and profile never leave this layer.
// Deliberately admin-scoped, not tenant-scoped: the route is behind requireAdmin.

export interface AdminUserRow {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastSeenAt: Date | null;
}

const SELECT = {
  id: true,
  username: true,
  isAdmin: true,
  createdAt: true,
  lastLoginAt: true,
  lastSeenAt: true,
} as const;

export const userAdminRepo = {
  listAll(): Promise<AdminUserRow[]> {
    return prisma.appUser.findMany({ select: SELECT, orderBy: { createdAt: 'asc' } });
  },

  findById(id: string): Promise<AdminUserRow | null> {
    return prisma.appUser.findUnique({ where: { id }, select: SELECT });
  },

  countAdmins(): Promise<number> {
    return prisma.appUser.count({ where: { isAdmin: true } });
  },

  setAdmin(id: string, isAdmin: boolean): Promise<AdminUserRow> {
    return prisma.appUser.update({ where: { id }, data: { isAdmin }, select: SELECT });
  },

  /** Delete the account, ALL its data (IMP-1 wipe order, structure included) and
   *  its sessions in one transaction. The app_user FKs are RESTRICT, so the row
   *  delete must come after the wipe; the session table is connect-pg-simple's
   *  (not a Prisma model) — revocation is a raw delete on the sess JSON. */
  async deleteUserCompletely(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await deleteAllUserData(tx, id, { keepStructure: false });
      await tx.appUser.delete({ where: { id } });
      await tx.$executeRaw`DELETE FROM "session" WHERE "sess"->>'userId' = ${id}`;
    });
  },
};
