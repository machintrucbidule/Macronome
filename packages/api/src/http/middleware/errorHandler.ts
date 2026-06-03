import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { logger } from '../../observability/logger.js';
import { ApiError } from '../errors.js';

interface ErrorBody {
  error: { code: string; message?: string; details?: Record<string, string> };
}

// Terminal error middleware: serialise ApiError to the contract envelope; map any
// unexpected error to a generic 500 (never leak a stack trace — security.md §7).
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    const body: ErrorBody = { error: { code: err.code } };
    if (err.details) body.error.details = err.details;
    res.status(err.status).json(body);
    return;
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: ErrorCode.Internal } });
}
