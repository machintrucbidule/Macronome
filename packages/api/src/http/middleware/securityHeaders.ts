import helmet from 'helmet';
import type { RequestHandler } from 'express';

// Security headers emitted by the app itself. Before ADR-0001 these were set by the
// bundled Caddy proxy; now the API serves the SPA, so it must send them (security.md).
// The CSP mirrors the former Caddyfile: self-only, plus data: images and inline styles
// (the SPA injects styles) and self-only XHR/fetch (same-origin /api/v1). Sole
// third-party allowance: the Chronodrive CDN in img-src — the food modal's product
// thumbnails (B-182) are the one resource the browser loads externally (public
// images, not proxied in v1; owner-approved).
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://*.chronodrive.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        // Same-origin SPA served over the operator's chosen scheme (may be plain HTTP on
        // a LAN). Do NOT force-upgrade subresources to https — the app has no TLS listener,
        // so it would break direct HTTP exposure (ADR-0001 allows "expose it directly").
        'upgrade-insecure-requests': null,
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}
