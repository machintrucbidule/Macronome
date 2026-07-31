import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { userRepo } from '../../data/repositories/user.repo.js';
import { logger } from '../../observability/logger.js';
import { ApiError } from '../errors.js';

// Gate for authenticated routes: 401 unauthorized when there is no session user.
// A passing request also refreshes last_seen_at (throttled to one write per 5
// minutes in SQL — B-190/B-239), fire-and-forget: the stamp never blocks or
// fails the request.
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    next(new ApiError(401, ErrorCode.Unauthorized));
    return;
  }
  void userRepo.recordActivity(req.session.userId).catch((err: unknown) => {
    logger.warn({ err }, 'last_seen_at stamp failed');
  });
  next();
}
