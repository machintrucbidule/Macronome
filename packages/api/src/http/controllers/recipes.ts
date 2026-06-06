import type { Request, Response } from 'express';
import {
  CreateRecipeSchema,
  ErrorCode,
  RecipeListQuerySchema,
  RecipePreviewRequestSchema,
  UpdateRecipeSchema,
} from '@macronome/shared';
import * as recipesService from '../../services/recipes.js';
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
  const parsed = RecipeListQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json(await recipesService.list(userId(res), parsed.data));
}

export async function get(req: Request, res: Response): Promise<void> {
  const recipe = await recipesService.get(userId(res), pathId(req));
  if (!recipe) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ data: recipe });
}

export async function preview(req: Request, res: Response): Promise<void> {
  const parsed = RecipePreviewRequestSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  res.status(200).json({ data: await recipesService.preview(userId(res), parsed.data) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateRecipeSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const { recipe, warnings } = await recipesService.create(userId(res), parsed.data);
  res.status(201).json({ data: recipe, ...(warnings.length ? { warnings } : {}) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const parsed = UpdateRecipeSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(422, ErrorCode.ValidationError, zodDetails(parsed.error));
  const result = await recipesService.update(userId(res), pathId(req), parsed.data);
  if (!result) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({
    data: result.recipe,
    ...(result.warnings.length ? { warnings: result.warnings } : {}),
  });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const ok = await recipesService.archive(userId(res), pathId(req));
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ ok: true });
}

export async function restore(req: Request, res: Response): Promise<void> {
  const ok = await recipesService.restore(userId(res), pathId(req));
  if (!ok) throw new ApiError(404, ErrorCode.NotFound);
  res.status(200).json({ ok: true });
}
