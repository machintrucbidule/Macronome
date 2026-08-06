import type { Request, Response } from 'express';
import {
  AdoptFoodRefSchema,
  CreateFoodSchema,
  ErrorCode,
  FoodListQuerySchema,
  FoodParseLabelRequestSchema,
  UpdateFoodSchema,
} from '@macronome/shared';
import * as foodsService from '../../services/foods.js';
import { ApiError, zodDetails } from '../errors.js';

// THIN controllers (api-CLAUDE.md): Zod-parse the request → call the service →
// serialise. requireAuth guarantees a session user, exposed via res.locals.userId.
function userId(res: Response): string {
  return res.locals.userId as string;
}

function pathId(req: Request): string {
  return req.params.id as string;
}

export async function list(req: Request, res: Response): Promise<void> {
  const parsed = FoodListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await foodsService.list(userId(res), parsed.data));
}

export async function get(req: Request, res: Response): Promise<void> {
  const food = await foodsService.get(userId(res), pathId(req));
  if (!food) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: food });
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateFoodSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const { food, warnings } = await foodsService.create(userId(res), parsed.data);
  res.status(201).json({ data: food, ...(warnings.length ? { warnings } : {}) });
}

/** Adopt a Ciqual reference entry (B-293). 201 when created, 200 when it already existed —
 *  the endpoint is idempotent, so a second pick of the same entry is not an error. */
export async function createFromRef(req: Request, res: Response): Promise<void> {
  const parsed = AdoptFoodRefSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const result = await foodsService.createFromRef(
    userId(res),
    parsed.data.ref_id,
    parsed.data.locale,
  );
  if (!result) throw new ApiError(404, ErrorCode.NotFound);
  res.status(result.created ? 201 : 200).json({ data: result.food });
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = UpdateFoodSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const result = await foodsService.update(userId(res), pathId(req), parsed.data);
  if (!result) throw new ApiError(404, ErrorCode.NotFound);
  res
    .status(200)
    .json({ data: result.food, ...(result.warnings.length ? { warnings: result.warnings } : {}) });
}

// Stateless macro-label parser (PM-1/B-114): pure text→numbers, no user scope, no async
// work — Express forwards a synchronous throw to the error middleware. A structured parse
// failure maps to 422 with the domain code (writes nothing).
export function parseLabel(req: Request, res: Response): void {
  const parsed = FoodParseLabelRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const out = foodsService.parseLabel(parsed.data.label_text);
  if (!out.ok) throw new ApiError(422, out.code);
  res
    .status(200)
    .json({ data: out.data, ...(out.warnings.length ? { warnings: out.warnings } : {}) });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const ok = await foodsService.archive(userId(res), pathId(req));
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ ok: true });
}

export async function restore(req: Request, res: Response): Promise<void> {
  const ok = await foodsService.restore(userId(res), pathId(req));
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ ok: true });
}
