import { createHash, randomBytes } from 'node:crypto';
import type {
  AccountTokenKind,
  AccountTokenSummary,
  CreatedToken,
  RegisterRequest,
  ResetPasswordRequest,
  SessionUser,
  TokenStateResponse,
} from '@macronome/shared';
import { ErrorCode } from '@macronome/shared';
import argon2 from 'argon2';
import { accountTokenRepo, type AccountTokenRow } from '../data/repositories/account-token.repo.js';
import { userRepo } from '../data/repositories/user.repo.js';
import { ApiError } from '../http/errors.js';
import { createAccount } from './account-create.js';

// Single-use link tokens (spec/api/users-admin.md §Token endpoints + 00-conventions
// §7; B-193/B-194). The raw token is returned once at creation; only its sha256 is
// stored. Consumption deletes the row. All invalid states (unknown / expired /
// revoked / wrong kind) collapse into one non-enumerating token_invalid error.
const TTL_MS = 7 * 24 * 3600_000;

const sha256 = (raw: string): string => createHash('sha256').update(raw).digest('hex');

function toSummary(row: AccountTokenRow, usernames: Map<string, string>): AccountTokenSummary {
  return {
    id: row.id,
    kind: row.kind as AccountTokenKind,
    is_admin: row.isAdmin,
    username: row.userId ? (usernames.get(row.userId) ?? null) : null,
    created_at: row.createdAt.toISOString(),
    expires_at: row.expiresAt.toISOString(),
  };
}

async function mint(
  kind: AccountTokenKind,
  isAdmin: boolean,
  userId: string | null,
): Promise<CreatedToken> {
  const raw = randomBytes(32).toString('base64url');
  const row = await accountTokenRepo.create({
    kind,
    tokenHash: sha256(raw),
    isAdmin,
    userId,
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return { id: row.id, token: raw, expires_at: row.expiresAt.toISOString(), is_admin: isAdmin };
}

/** A live row for the raw token, or null (unknown / expired / wrong kind). */
async function findValid(raw: string, kind: AccountTokenKind): Promise<AccountTokenRow | null> {
  const row = await accountTokenRepo.findByHash(sha256(raw));
  if (!row || row.kind !== kind || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export function createInvite(isAdmin: boolean): Promise<CreatedToken> {
  return mint('invite', isAdmin, null);
}

/** Reset link for an account; replaces its pending one (owner decision). */
export async function createResetToken(actorId: string, userId: string): Promise<CreatedToken> {
  const target = await userRepo.findById(userId);
  if (!target) throw new ApiError(404, ErrorCode.NotFound);
  if (userId === actorId) throw new ApiError(409, ErrorCode.OwnAccount);
  await accountTokenRepo.deleteResetTokensFor(userId);
  return mint('password_reset', false, userId);
}

export async function listTokens(): Promise<AccountTokenSummary[]> {
  await accountTokenRepo.purgeExpired(new Date());
  const rows = await accountTokenRepo.listAll();
  const usernames = await accountTokenRepo.usernamesByIds(
    rows.map((r) => r.userId).filter((id): id is string => id !== null),
  );
  return rows.map((row) => toSummary(row, usernames));
}

export async function revokeToken(id: string): Promise<void> {
  if (!(await accountTokenRepo.deleteById(id))) throw new ApiError(404, ErrorCode.NotFound);
}

/** Non-enumerating probe for the /invite and /reset pages. */
export async function tokenState(raw: string): Promise<TokenStateResponse> {
  const row = await accountTokenRepo.findByHash(sha256(raw));
  if (!row || row.expiresAt.getTime() < Date.now()) return { valid: false };
  return { valid: true, kind: row.kind as AccountTokenKind, is_admin: row.isAdmin };
}

/** Token-gated registration (B-193): the §7 carve-out. Consumes the invite only
 *  after the account exists, so username_taken never burns the link. */
export async function registerWithInvite(input: RegisterRequest): Promise<SessionUser> {
  const invite = await findValid(input.token, 'invite');
  if (!invite) throw new ApiError(409, ErrorCode.TokenInvalid);
  if (await userRepo.findByUsername(input.username.toLowerCase())) {
    throw new ApiError(409, ErrorCode.UsernameTaken);
  }
  const user = await createAccount(input, invite.isAdmin).catch((err: unknown) => {
    // P2002 = unique violation — the check-then-act race backstop.
    if ((err as { code?: string }).code === 'P2002') {
      throw new ApiError(409, ErrorCode.UsernameTaken);
    }
    throw err;
  });
  await accountTokenRepo.deleteById(invite.id);
  return user;
}

/** Set a new password from a reset link (B-194): consumes the token and revokes
 *  every session of the account (a forgotten password means the old sessions
 *  can no longer be trusted). */
export async function resetPassword(input: ResetPasswordRequest): Promise<void> {
  const token = await findValid(input.token, 'password_reset');
  if (!token?.userId) throw new ApiError(409, ErrorCode.TokenInvalid);
  await userRepo.updatePasswordHash(
    token.userId,
    await argon2.hash(input.new_password, { type: argon2.argon2id }),
  );
  await accountTokenRepo.deleteById(token.id);
  await userRepo.revokeAllSessions(token.userId);
}
