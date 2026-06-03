import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Wrap an async controller so rejected promises forward to the error middleware
// and the handler keeps the void-returning RequestHandler shape Express expects.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
