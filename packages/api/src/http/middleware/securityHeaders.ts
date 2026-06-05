import helmet from 'helmet';
import type { RequestHandler } from 'express';

// Security headers emitted by the app itself. Before ADR-0001 these were set by the
// bundled Caddy proxy; now the API serves the SPA, so it must send them (security.md).
// The CSP mirrors the former Caddyfile: self-only, plus data: images and inline styles
// (the SPA injects styles) and self-only XHR/fetch (same-origin /api/v1).
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}
