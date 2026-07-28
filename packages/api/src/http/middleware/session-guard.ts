import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ErrorCode } from '@macronome/shared';
import { isDatabaseUnavailable } from '../../observability/db-unavailable.js';
import { logger } from '../../observability/logger.js';
import { ApiError } from '../errors.js';

// Makes a session-store failure survivable (B-231 hardening).
//
// When the store cannot be reached, express-session calls next(err). Express then skips every
// non-error middleware — including the static SPA — so a document request answers
// `{"error":{"code":"internal_error"}}` and the browser shows raw JSON instead of the application.
// The user cannot even reach the login screen, let alone read a message explaining why.
//
// So: API calls get a typed, honest 503 the client can classify; anything else (the SPA, its assets)
// is served with NO session, which is exactly right for an unauthenticated visitor — the login page
// renders and can then say what is wrong.
const API_PREFIX = '/api/';

export function withSessionGuard(session: RequestHandler): RequestHandler {
  return function sessionGuard(req: Request, res: Response, next: NextFunction): void {
    session(req, res, (err?: unknown) => {
      if (!err) {
        next();
        return;
      }
      const dbDown = isDatabaseUnavailable(err);
      logger.warn({ err, dbDown, path: req.path }, 'session store unavailable');
      if (req.path.startsWith(API_PREFIX)) {
        next(new ApiError(503, dbDown ? ErrorCode.DatabaseUnavailable : ErrorCode.Internal));
        return;
      }
      next();
    });
  };
}
