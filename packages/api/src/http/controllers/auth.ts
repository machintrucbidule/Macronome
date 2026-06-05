import type { Request, Response } from 'express';
import {
  ErrorCode,
  LoginRequestSchema,
  PasswordChangeRequestSchema,
  SetupRequestSchema,
} from '@macronome/shared';
import * as authService from '../../services/auth.js';
import * as setupService from '../../services/setup.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers: Zod-parse the request → call a service → serialise. No maths,
// no SQL (docs/architecture/context-files/api-CLAUDE.md).
const STAY_SIGNED_IN_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

// Promisify an express-session node-style callback, normalising the error to an Error.
function fromCallback(fn: (cb: (err?: unknown) => void) => void): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    fn((err) =>
      err ? reject(err instanceof Error ? err : new Error('session operation failed')) : resolve(),
    ),
  );
}

// Privilege elevation regenerates the session id (anti-fixation; security.md §1/§4). It also
// makes the authenticated session a fresh row written last in the auth response, hardening the
// setup→reload handoff (B-022). The CSRF token is carried forward so the SPA's double-submit
// header keeps matching without an extra round-trip; userId is then set by the caller.
async function elevateSession(req: Request, userId: string): Promise<void> {
  const csrfToken = req.session.csrfToken;
  await fromCallback((cb) => req.session.regenerate(cb));
  if (csrfToken !== undefined) req.session.csrfToken = csrfToken;
  req.session.userId = userId;
}

function saveSession(req: Request): Promise<void> {
  return fromCallback((cb) => req.session.save(cb));
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));

  const user = await authService.authenticate(parsed.data.username, parsed.data.password);
  if (!user) throw new ApiError(401, ErrorCode.InvalidCredentials);

  await elevateSession(req, user.id);
  if (parsed.data.stay_signed_in) req.session.cookie.maxAge = STAY_SIGNED_IN_MS;
  await saveSession(req);
  res.status(200).json({ user });
}

export async function setupState(_req: Request, res: Response): Promise<void> {
  res.status(200).json(await setupService.getSetupState());
}

export async function setup(req: Request, res: Response): Promise<void> {
  const parsed = SetupRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));

  const user = await setupService.setupOwner(parsed.data);
  if (!user) throw new ApiError(409, ErrorCode.SetupAlreadyCompleted);

  await elevateSession(req, user.id);
  await saveSession(req);
  res.status(200).json({ user });
}

export async function session(req: Request, res: Response): Promise<void> {
  const userId = req.session.userId;
  if (!userId) throw new ApiError(401, ErrorCode.Unauthorized);

  const user = await authService.getSessionUser(userId);
  if (!user) throw new ApiError(401, ErrorCode.Unauthorized);
  res.status(200).json({ user });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
  res.clearCookie('macronome.sid');
  res.status(204).end();
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.session.userId;
  if (!userId) throw new ApiError(401, ErrorCode.Unauthorized);

  const parsed = PasswordChangeRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));

  const ok = await authService.changePassword(
    userId,
    parsed.data.current_password,
    parsed.data.new_password,
  );
  if (!ok) throw new ApiError(401, ErrorCode.InvalidCredentials);
  res.status(204).end();
}
