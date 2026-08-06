import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { authDiagnostics } from './http/middleware/auth-diagnostics.js';
import { csrf } from './http/middleware/csrf.js';
import { errorHandler } from './http/middleware/errorHandler.js';
import { secureCookieWarn } from './http/middleware/secure-cookie-warn.js';
import { securityHeaders } from './http/middleware/securityHeaders.js';
import { sessionMiddleware } from './http/middleware/session.js';
import { applySessionCookieSecure } from './http/middleware/session-cookie-secure.js';
import { sessionDiagnostics } from './http/middleware/session-diagnostics.js';
import { withSessionGuard } from './http/middleware/session-guard.js';
import { tenantContext } from './http/middleware/tenant.js';
import { applyTrustProxy } from './http/middleware/trustProxy.js';
import { serveSpa } from './http/spa.js';
import aboutRoutes from './http/routes/about.js';
import aiRoutes from './http/routes/ai.js';
import authRoutes from './http/routes/auth.js';
import containersRoutes from './http/routes/containers.js';
import dataRoutes from './http/routes/data.js';
import daysRoutes from './http/routes/days.js';
import foodRefsRoutes from './http/routes/food-refs.js';
import foodsRoutes from './http/routes/foods.js';
import healthRoutes from './http/routes/health.js';
import integrationsRoutes from './http/routes/integrations.js';
import journalRoutes from './http/routes/journal.js';
import leftoverRoutes from './http/routes/leftover.js';
import mealsRoutes from './http/routes/meals.js';
import mealTemplateRoutes from './http/routes/mealTemplate.js';
import pantryRoutes from './http/routes/pantry.js';
import profileRoutes from './http/routes/profile.js';
import recipesRoutes from './http/routes/recipes.js';
import searchRoutes from './http/routes/search.js';
import settingsRoutes from './http/routes/settings.js';
import statsRoutes from './http/routes/stats.js';
import targetRoutes from './http/routes/target.js';
import targetsRoutes from './http/routes/targets.js';
import usersAdminRoutes from './http/routes/users-admin.js';
import weightRoutes from './http/routes/weight.js';
import { logger } from './observability/logger.js';

// Fixed middleware order (ARCHITECTURE.md §3): trust-proxy → session → CSRF →
// (rate-limit per-route) → tenant → routes → error handler.
export function createApp(): Express {
  const app = express();

  applyTrustProxy(app);
  app.use(securityHeaders());
  app.use(pinoHttp({ logger }));
  // Authentication black box (B-231). Deliberately BEFORE the body parser and the session: its
  // response listener must already be registered when the failure comes from upstream of the routes
  // (body parse, session store, database) — that is the outage class which twice left no trace.
  app.use(authDiagnostics);
  // Warn if Secure cookies are forced but requests arrive insecure (untrusted proxy).
  app.use(secureCookieWarn);
  // 25 MB body cap so a full data import (IMP-1) fits; ordinary payloads are tiny.
  app.use(express.json({ limit: '25mb' }));
  // Wrapped so a store outage yields a typed 503 for the API and still serves the SPA (B-231).
  app.use(withSessionGuard(sessionMiddleware));
  // Read the "was the session found?" verdict before csrf mints into a fresh session and before a
  // controller regenerates the id (B-231).
  app.use(sessionDiagnostics);
  // Correct `Secure` on sessions loaded from the store, whose cookie attributes come back frozen
  // from the stored row (B-232). Before csrf so the CSRF response carries the same attribute.
  app.use(applySessionCookieSecure);
  app.use(csrf);
  app.use(tenantContext);

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/about', aboutRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/foods', foodsRoutes);
  app.use('/api/v1/food-refs', foodRefsRoutes);
  app.use('/api/v1/recipes', recipesRoutes);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/target', targetRoutes);
  app.use('/api/v1/targets', targetsRoutes);
  app.use('/api/v1/weight', weightRoutes);
  app.use('/api/v1/profile', profileRoutes);
  app.use('/api/v1/days', daysRoutes);
  app.use('/api/v1/meals', mealsRoutes);
  app.use('/api/v1/leftover', leftoverRoutes);
  app.use('/api/v1/journal', journalRoutes);
  app.use('/api/v1/stats', statsRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/integrations', integrationsRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/containers', containersRoutes);
  app.use('/api/v1/meal-template', mealTemplateRoutes);
  app.use('/api/v1/pantry', pantryRoutes);
  app.use('/api/v1/data', dataRoutes);
  app.use('/api/v1/users', usersAdminRoutes);

  // Serve the built SPA from the same origin in prod (ADR-0001); inert in dev.
  if (env.WEB_DIST) serveSpa(app, env.WEB_DIST);

  app.use(errorHandler);
  return app;
}
