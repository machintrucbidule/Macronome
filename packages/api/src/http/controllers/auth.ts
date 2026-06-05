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

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));

  const user = await authService.authenticate(parsed.data.username, parsed.data.password);
  if (!user) throw new ApiError(401, ErrorCode.InvalidCredentials);

  req.session.userId = user.id;
  if (parsed.data.stay_signed_in) req.session.cookie.maxAge = STAY_SIGNED_IN_MS;
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

  req.session.userId = user.id;
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
