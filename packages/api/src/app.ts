import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { csrf } from './http/middleware/csrf.js';
import { errorHandler } from './http/middleware/errorHandler.js';
import { sessionMiddleware } from './http/middleware/session.js';
import { tenantContext } from './http/middleware/tenant.js';
import { applyTrustProxy } from './http/middleware/trustProxy.js';
import authRoutes from './http/routes/auth.js';
import daysRoutes from './http/routes/days.js';
import foodsRoutes from './http/routes/foods.js';
import healthRoutes from './http/routes/health.js';
import journalRoutes from './http/routes/journal.js';
import leftoverRoutes from './http/routes/leftover.js';
import mealsRoutes from './http/routes/meals.js';
import profileRoutes from './http/routes/profile.js';
import recipesRoutes from './http/routes/recipes.js';
import searchRoutes from './http/routes/search.js';
import targetRoutes from './http/routes/target.js';
import weightRoutes from './http/routes/weight.js';
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
  app.use('/api/v1/foods', foodsRoutes);
  app.use('/api/v1/recipes', recipesRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/target', targetRoutes);
  app.use('/api/v1/weight', weightRoutes);
  app.use('/api/v1/profile', profileRoutes);
  app.use('/api/v1/days', daysRoutes);
  app.use('/api/v1/meals', mealsRoutes);
  app.use('/api/v1/leftover', leftoverRoutes);
  app.use('/api/v1/journal', journalRoutes);

  app.use(errorHandler);
  return app;
}
