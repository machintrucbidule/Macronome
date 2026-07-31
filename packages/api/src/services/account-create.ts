import argon2 from 'argon2';
import type { SessionUser, SetupRequest } from '@macronome/shared';
import { userRepo } from '../data/repositories/user.repo.js';
import { seedAppearance } from './settings.js';
import { seedDefaultsForUser } from './user-bootstrap.js';

// Shared account creation (extracted from the first-run setup for B-193): hash the
// password (argon2id), create the row with the given role, seed the defaults (meal
// template + locked "Rien"), seed the appearance from the pre-auth choice (B-237), and
// stamp the creation as a login (B-190 — both the wizard and an invite registration open
// a session immediately). Gates (zero-user for setup, token validity for invites) belong
// to the callers.
export async function createAccount(input: SetupRequest, isAdmin: boolean): Promise<SessionUser> {
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await userRepo.create({
    username: input.username,
    passwordHash,
    sex: input.sex,
    birthdate: new Date(input.birthdate),
    heightCm: input.height_cm,
    isAdmin,
  });
  await seedDefaultsForUser(user.id);
  const appearance = await seedAppearance(user.id, { locale: input.locale, theme: input.theme });
  await userRepo.recordLogin(user.id);

  return {
    id: user.id,
    username: input.username.toLowerCase(),
    ...appearance,
    is_admin: isAdmin,
  };
}
