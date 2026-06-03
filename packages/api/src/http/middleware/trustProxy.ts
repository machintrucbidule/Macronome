import type { Express } from 'express';
import { env } from '../../config/env.js';

// Trust forwarded client-IP headers ONLY from the configured proxy, so login
// rate-limiting keys on the real client IP regardless of frontal (security.md §3).
export function applyTrustProxy(app: Express): void {
  app.set('trust proxy', env.TRUSTED_PROXY === 'loopback' ? 'loopback' : env.TRUSTED_PROXY);
}
