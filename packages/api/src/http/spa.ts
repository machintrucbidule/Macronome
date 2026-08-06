import express, { type Express, type Response } from 'express';
import { existsSync } from 'node:fs';
import { join, sep } from 'node:path';

// Serve the built SPA (packages/web/dist) from the API process in production, so a
// single combined image fronts both the UI and /api/v1 (ADR-0001). Mounted AFTER the
// /api/v1/* routes and BEFORE the error handler; the history fallback excludes /api/*
// so unknown API paths still 404 instead of returning index.html. Inert in dev: when
// WEB_DIST is unset/absent this is never called and Vite serves the SPA.
//
// B-287, cache policy (ops.md §6b): Vite content-hashes everything it emits into /assets,
// so those URLs can never change meaning — cache them for a year. EVERYTHING else must
// revalidate: index.html is the shell the whole app hangs off, and a cached sw.js would
// freeze the update path itself. Without this, express.static gave all of them the same
// `max-age=0` and left the real policy to whatever proxy the operator fronts the port with.
const ONE_YEAR_S = 31_536_000;
const IMMUTABLE = `public, max-age=${ONE_YEAR_S}, immutable`;
const REVALIDATE = 'no-cache';

/** True for Vite's content-hashed output, the only files safe to cache long-term. */
function isHashedAsset(filePath: string): boolean {
  return filePath.includes(`${sep}assets${sep}`);
}

function cacheHeaders(res: Response, filePath: string): void {
  res.setHeader('Cache-Control', isHashedAsset(filePath) ? IMMUTABLE : REVALIDATE);
}

export function serveSpa(app: Express, dir: string): void {
  if (!existsSync(dir)) return;
  app.use(express.static(dir, { index: false, setHeaders: cacheHeaders }));
  // Any non-API GET returns index.html so client-side routing (deep links) works.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', REVALIDATE);
    res.sendFile(join(dir, 'index.html'));
  });
}
