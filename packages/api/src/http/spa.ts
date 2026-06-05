import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Serve the built SPA (packages/web/dist) from the API process in production, so a
// single combined image fronts both the UI and /api/v1 (ADR-0001). Mounted AFTER the
// /api/v1/* routes and BEFORE the error handler; the history fallback excludes /api/*
// so unknown API paths still 404 instead of returning index.html. Inert in dev: when
// WEB_DIST is unset/absent this is never called and Vite serves the SPA.
export function serveSpa(app: Express, dir: string): void {
  if (!existsSync(dir)) return;
  app.use(express.static(dir, { index: false }));
  // Any non-API GET returns index.html so client-side routing (deep links) works.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(join(dir, 'index.html'));
  });
}
