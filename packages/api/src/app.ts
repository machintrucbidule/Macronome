import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { csrf } from './http/middleware/csrf.js';
import { errorHandler } from './http/middleware/errorHandler.js';
import { sessionMiddleware } from './http/middleware/session.js';
import { tenantContext } from './http/middleware/tenant.js';
import { applyTrustProxy } from './http/middleware/trustProxy.js';
import authRoutes from './http/routes/auth.js';
import healthRoutes from './http/routes/health.js';
import { logger } from './observability/logger.js';

// Fixed middleware order (ARCHITECTURE.md §3): trust-proxy → session → CSRF →
// (rate-limit per-route) → tenant → routes → error handler.
export function createApp(): Express {
  const app = express();

  applyTrustProxy(app);
  app.use(helmet());
  app.use(pinoHttp({ logger }));
  app.use(express.json());
  app.use(sessionMiddleware);
  app.use(csrf);
  app.use(tenantContext);

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);

  app.use(errorHandler);
  return app;
}
