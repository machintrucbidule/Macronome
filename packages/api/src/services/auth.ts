import argon2 from 'argon2';
import type { SessionUser } from '@macronome/shared';
import { userRepo, type UserRow } from '../data/repositories/user.repo.js';

// Auth orchestration. argon2id verification; the failure path is non-enumerating:
// an unknown username still runs a hash verify (uniform timing, no existence leak).

let dummyHash: Promise<string> | null = null;
function dummyHashOnce(): Promise<string> {
  dummyHash ??= argon2.hash('not-a-real-password');
  return dummyHash;
}

interface UserSettings {
  locale?: 'fr' | 'en';
  theme?: 'system' | 'light' | 'dark';
}

function toSessionUser(user: UserRow): SessionUser {
  const settings = (user.settings ?? {}) as UserSettings;
  return {
    id: user.id,
    username: user.username,
    locale: settings.locale ?? 'fr',
    theme: settings.theme ?? 'dark',
    is_admin: user.isAdmin,
  };
}

/** Returns the session user on valid credentials, else null (generic 401 upstream). */
export async function authenticate(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await userRepo.findByUsername(username.toLowerCase());
  const hash = user?.passwordHash ?? (await dummyHashOnce());
  const valid = await argon2.verify(hash, password).catch(() => false);
  if (!user || !valid) return null;
  await userRepo.recordLogin(user.id);
  return toSessionUser(user);
}

/** Resolve the session user from a stored session id (GET /auth/session). */
export async function getSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await userRepo.findById(userId);
  return user ? toSessionUser(user) : null;
}

/** Verify the current password and set a new argon2id hash. Returns false if wrong. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await userRepo.findById(userId);
  if (!user) return false;
  const valid = await argon2.verify(user.passwordHash, currentPassword).catch(() => false);
  if (!valid) return false;
  await userRepo.updatePasswordHash(
    userId,
    await argon2.hash(newPassword, { type: argon2.argon2id }),
  );
  return true;
}
