import type { Request, Response } from 'express';
import { CreateInviteSchema, ErrorCode } from '@macronome/shared';
import * as accountTokens from '../../services/account-tokens.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers for the admin token-link endpoints (spec/api/users-admin.md
// §Token endpoints, B-193/B-194). Mounted behind requireAuth + requireAdmin;
// the service throws the 404 / 409 (own_account) cases.
function actorId(res: Response): string {
  return res.locals.userId as string;
}

export async function createInvite(req: Request, res: Response): Promise<void> {
  const parsed = CreateInviteSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(201).json({ data: await accountTokens.createInvite(parsed.data.is_admin) });
}

export async function listTokens(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await accountTokens.listTokens() });
}

export async function revokeToken(req: Request, res: Response): Promise<void> {
  await accountTokens.revokeToken(req.params.id as string);
  res.status(204).end();
}

export async function createResetToken(req: Request, res: Response): Promise<void> {
  const token = await accountTokens.createResetToken(actorId(res), req.params.id as string);
  res.status(201).json({ data: token });
}
