import type { AdminUser } from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import { userAdminRepo, type AdminUserRow } from '../data/repositories/user-admin.repo.js';
import { ApiError } from '../http/errors.js';

// Admin user management (spec/api/users-admin.md, B-192). Guards live here:
// no self-action (own_account — an admin never changes/deletes their own
// account, another admin must) and never fewer than 1 admin (last_admin —
// unreachable through normal HTTP flow once own_account holds, kept as a
// race-safety net). Check-then-act races are acceptable on this single-box app.

function toDto(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    is_admin: row.isAdmin,
    created_at: row.createdAt.toISOString(),
    last_login_at: row.lastLoginAt?.toISOString() ?? null,
    last_seen_at: row.lastSeenAt?.toISOString() ?? null,
  };
}

export async function list(): Promise<AdminUser[]> {
  return (await userAdminRepo.listAll()).map(toDto);
}

async function guardedTarget(actorId: string, id: string): Promise<AdminUserRow> {
  const row = await userAdminRepo.findById(id);
  if (!row) throw new ApiError(404, ErrorCode.NotFound);
  if (id === actorId) throw new ApiError(409, ErrorCode.OwnAccount);
  return row;
}

export async function setRole(actorId: string, id: string, isAdmin: boolean): Promise<AdminUser> {
  const row = await guardedTarget(actorId, id);
  if (row.isAdmin && !isAdmin && (await userAdminRepo.countAdmins()) === 1) {
    throw new ApiError(409, ErrorCode.LastAdmin);
  }
  return toDto(await userAdminRepo.setAdmin(id, isAdmin));
}

export async function remove(actorId: string, id: string): Promise<void> {
  const row = await guardedTarget(actorId, id);
  if (row.isAdmin && (await userAdminRepo.countAdmins()) === 1) {
    throw new ApiError(409, ErrorCode.LastAdmin);
  }
  await userAdminRepo.deleteUserCompletely(id);
}
