import type { Express } from 'express';
import { env } from '../../config/env.js';

// Trust forwarded client-IP / `X-Forwarded-Proto` headers only from the configured
// peers, so login rate-limiting keys on the real client IP and `req.secure` reflects the
// frontal's TLS (security.md §3). The value is any Express `trust proxy` setting — a CIDR,
// a comma-separated list, a preset (`loopback`/`uniquelocal`), or a numeric hop count —
// passed straight through (default `loopback, uniquelocal`, see config/env.ts).
export function applyTrustProxy(app: Express): void {
  app.set('trust proxy', env.TRUSTED_PROXY);
}
