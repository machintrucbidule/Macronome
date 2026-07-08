import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { userRepo } from '../../data/repositories/user.repo.js';
import { ApiError } from '../errors.js';

// Role gate for admin-only routes (spec/api/users-admin.md, B-192). Runs after
// requireAuth. The role is re-read from the DB on every request — nothing is
// cached in the session, so a demotion takes effect immediately.
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  userRepo
    .findById(req.session.userId as string)
    .then((user) => {
      if (user?.isAdmin) next();
      else next(new ApiError(403, ErrorCode.Forbidden));
    })
    .catch(next);
}
