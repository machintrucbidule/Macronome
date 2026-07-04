import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';

// Security headers (securityHeaders.ts). Regression guard for the plain-HTTP deploy bug:
// the CSP must NOT carry `upgrade-insecure-requests`, otherwise browsers force the
// same-origin SPA assets to https and they fail when the app is exposed directly over
// HTTP (ADR-0001 allows "expose it directly"). Header-only — no DB/auth needed.
const app = createApp();

describe('CSP security headers', () => {
  it('does not emit upgrade-insecure-requests so plain-HTTP deploys load assets', async () => {
    const res = await request(app).get('/api/v1/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('keeps the intended self-only directives (+ the Chronodrive CDN img allowance)', async () => {
    const res = await request(app).get('/api/v1/health');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    // B-182 prod follow-up: product thumbnails are the sole third-party resource.
    expect(csp).toContain("img-src 'self' data: https://*.chronodrive.com");
  });
});
