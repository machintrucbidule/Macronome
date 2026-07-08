import type { Request, Response } from 'express';
import { ErrorCode, SetAdminSchema } from '@macronome/shared';
import * as usersAdminService from '../../services/users-admin.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers for admin user management (spec/api/users-admin.md, B-192).
// The service throws the 404 / 409 (own_account, last_admin) cases; the role
// gate is the require-admin middleware.
function actorId(res: Response): string {
  return res.locals.userId as string;
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await usersAdminService.list() });
}

export async function setRole(req: Request, res: Response): Promise<void> {
  const parsed = SetAdminSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const user = await usersAdminService.setRole(
    actorId(res),
    req.params.id as string,
    parsed.data.is_admin,
  );
  res.status(200).json({ data: user });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await usersAdminService.remove(actorId(res), req.params.id as string);
  res.status(204).end();
}
