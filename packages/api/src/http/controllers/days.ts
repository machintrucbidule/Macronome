import type { Request, Response } from 'express';
import { DayDateSchema, ErrorCode, PatchDaySchema } from '@macronome/shared';
import * as daysService from '../../services/days.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md): validate path/body → call the service → serialise.
// requireAuth exposes the session user via res.locals.userId.
function userId(res: Response): string {
  return res.locals.userId as string;
}

/** Validate the :date path segment as YYYY-MM-DD (422 otherwise). */
export function pathDate(req: Request): string {
  const parsed = DayDateSchema.safeParse(req.params.date);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, { date: 'invalid_date' });
  return parsed.data;
}

/** GET /days/:date — existing day or an unsaved scaffold (200). */
export async function get(req: Request, res: Response): Promise<void> {
  res.status(200).json(await daysService.get(userId(res), pathDate(req)));
}

/** POST /days/:date — materialize the day_log (201; idempotent). */
export async function materialize(req: Request, res: Response): Promise<void> {
  res.status(201).json(await daysService.materialize(userId(res), pathDate(req)));
}

/** PATCH /days/:date — upsert: activity / comment / verdict / summary_kcal (200; the day is
 *  auto-materialized when missing, so there is no 404; 409 on a read-only summary/Calories case). */
export async function patch(req: Request, res: Response): Promise<void> {
  const parsed = PatchDaySchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await daysService.patch(userId(res), pathDate(req), parsed.data));
}

/** POST /days/:date/detail — convert a summary day to detailed (seed meals; 200 DayDetail). */
export async function convertToDetailed(req: Request, res: Response): Promise<void> {
  res.status(200).json(await daysService.convertToDetailed(userId(res), pathDate(req)));
}

/** POST /days/:date/clear — empty the day, keeping pins@0 + comment + activity (200; 409 summary). */
export async function clear(req: Request, res: Response): Promise<void> {
  const day = await daysService.clear(userId(res), pathDate(req));
  if (!day) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json(day);
}
