import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { isDatabaseUnavailable } from '../../observability/db-unavailable.js';
import { logger } from '../../observability/logger.js';
import { attachRef, recordErrorCode } from '../diagnostics.js';
import { ApiError } from '../errors.js';

interface ErrorBody {
  error: { code: string; message?: string; details?: Record<string, string>; ref?: string };
}

// Terminal error middleware: serialise ApiError to the contract envelope; map any
// unexpected error to a generic 500 (never leak a stack trace — security.md §7).
//
// It also stamps the response so the authentication black box can record WHICH error the request
// settled on, and attaches the diagnostic `ref` the login screen shows (B-231).
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    const body: ErrorBody = { error: { code: err.code } };
    if (err.details) body.error.details = err.details;
    recordErrorCode(res, err.code);
    attachRef(res, body.error);
    res.status(err.status).json(body);
    return;
  }

  // A lost database connection is transient, not a bug: reporting it as 500 makes the client say
  // "technical problem" and sends the operator hunting a misconfiguration that does not exist
  // (B-231 hardening, spec/api/00-conventions.md).
  if (isDatabaseUnavailable(err)) {
    const body: ErrorBody = { error: { code: ErrorCode.DatabaseUnavailable } };
    recordErrorCode(res, ErrorCode.DatabaseUnavailable);
    attachRef(res, body.error);
    logger.warn({ err }, 'database unavailable');
    res.status(503).json(body);
    return;
  }

  const body: ErrorBody = { error: { code: ErrorCode.Internal } };
  recordErrorCode(res, ErrorCode.Internal);
  attachRef(res, body.error);
  logger.error({ err }, 'unhandled error');
  res.status(500).json(body);
}
