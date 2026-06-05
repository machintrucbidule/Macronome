import type { Request, Response } from 'express';
import { CreateContainerSchema, ErrorCode, UpdateContainerSchema } from '@macronome/shared';
import * as containersService from '../../services/containers.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers for the Contenants catalog. The service throws the 404 (tenancy), 403
// (locked built-in "Rien") and 409 (duplicate name) cases; here we just parse + serialise.
function userId(res: Response): string {
  return res.locals.userId as string;
}

export async function list(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await containersService.list(userId(res)) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateContainerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(201).json({ data: await containersService.create(userId(res), parsed.data) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = UpdateContainerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const container = await containersService.update(
    userId(res),
    req.params.id as string,
    parsed.data,
  );
  res.status(200).json({ data: container });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await containersService.remove(userId(res), req.params.id as string);
  res.status(204).end();
}
