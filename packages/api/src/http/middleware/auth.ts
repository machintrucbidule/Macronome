import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { ApiError } from '../errors.js';

// Gate for authenticated routes: 401 unauthorized when there is no session user.
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    next(new ApiError(401, ErrorCode.Unauthorized));
    return;
  }
  next();
}
