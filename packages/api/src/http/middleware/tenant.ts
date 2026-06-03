import type { NextFunction, Request, Response } from 'express';

// Tenant context: expose the authenticated user id so services can scope by it.
// (Repositories still take an explicit userId — this is the request-context source.)
export function tenantContext(req: Request, res: Response, next: NextFunction): void {
  res.locals.userId = req.session.userId ?? null;
  next();
}
