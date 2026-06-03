import type { PatchProfileRequest, Profile } from '@macronome/shared';
import {
  profileRepo,
  type ProfilePatch,
  type ProfileRow,
} from '../data/repositories/profile.repo.js';

// Profile service: thin mapping between the app_user metabolic slice and the contract
// DTO. No engine logic here (that lives in services/targets.ts + domain).

const num = (d: { toString(): string }): number => Number(d.toString());
const toDateString = (d: Date): string => d.toISOString().slice(0, 10);

function toDto(row: ProfileRow): Profile {
  return {
    sex: row.sex as Profile['sex'],
    birthdate: toDateString(row.birthdate),
    height_cm: num(row.heightCm),
  };
}

export async function get(userId: string): Promise<Profile | null> {
  const row = await profileRepo.get(userId);
  return row ? toDto(row) : null;
}

export async function patch(userId: string, body: PatchProfileRequest): Promise<Profile> {
  const data: ProfilePatch = {
    ...(body.sex !== undefined ? { sex: body.sex } : {}),
    ...(body.birthdate !== undefined ? { birthdate: new Date(body.birthdate) } : {}),
    ...(body.height_cm !== undefined ? { heightCm: body.height_cm } : {}),
  };
  return toDto(await profileRepo.update(userId, data));
}
