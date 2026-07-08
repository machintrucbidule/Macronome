import argon2 from 'argon2';
import type { SessionUser, SetupRequest } from '@macronome/shared';
import { userRepo } from '../data/repositories/user.repo.js';
import { seedDefaultsForUser } from './user-bootstrap.js';

// First-run bootstrap (spec/api/00-conventions.md §7). The single owner account is
// created here, gated to a zero-user database; once an owner exists it is permanently
// disabled. Reuses seedDefaultsForUser (default meal template + locked "Rien"), same as
// the create-user CLI fallback.

/** Whether the install still needs its owner account (true only at zero users). */
export async function getSetupState(): Promise<{ setup_required: boolean }> {
  const count = await userRepo.count();
  return { setup_required: count === 0 };
}

/**
 * Create the owner and return the session user, or null if an account already exists
 * (the controller maps null to 409 setup_already_completed). A fresh account has the
 * default settings blob, so locale/theme fall back to 'fr'/'dark'. The owner is admin,
 * and completing setup counts as a login (B-190).
 */
export async function setupOwner(input: SetupRequest): Promise<SessionUser | null> {
  if ((await userRepo.count()) > 0) return null;

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await userRepo.create({
    username: input.username,
    passwordHash,
    sex: input.sex,
    birthdate: new Date(input.birthdate),
    heightCm: input.height_cm,
    isAdmin: true,
  });
  await seedDefaultsForUser(user.id);
  await userRepo.recordLogin(user.id);

  return {
    id: user.id,
    username: input.username.toLowerCase(),
    locale: 'fr',
    theme: 'dark',
    is_admin: true,
  };
}
