import type { SessionUser, SetupRequest } from '@macronome/shared';
import { userRepo } from '../data/repositories/user.repo.js';
import { createAccount } from './account-create.js';

// First-run bootstrap (spec/api/00-conventions.md §7). The single owner account is
// created here, gated to a zero-user database; once an owner exists it is permanently
// disabled. The creation itself (hash, seed, login stamp) is shared with the invite
// registration (B-193) in account-create.ts.

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
  return createAccount(input, true);
}
