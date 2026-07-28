import { describe, expect, it } from 'vitest';
import { genuineAuthRoute, genuineAuthRoutes } from './routes.js';

// B-231, owner decision: only deliberate authentication attempts are recorded. The exclusions are
// the point — `GET /auth/session` answers 401 on every anonymous page load, so recording it would
// bury the anomaly under normal traffic.
describe('genuineAuthRoute', () => {
  it.each(genuineAuthRoutes())('accepts POST %s and returns the canonical route', (route) => {
    expect(genuineAuthRoute('POST', route)).toBe(route);
  });

  it.each([
    ['GET', '/api/v1/auth/session'],
    ['GET', '/api/v1/auth/setup-state'],
    ['POST', '/api/v1/auth/token-state'],
    ['POST', '/api/v1/auth/logout'],
    ['GET', '/api/v1/health'],
    ['POST', '/api/v1/foods'],
  ])('rejects %s %s', (method, path) => {
    expect(genuineAuthRoute(method, path)).toBeNull();
  });

  it('rejects a non-POST method on a genuine path', () => {
    expect(genuineAuthRoute('GET', '/api/v1/auth/login')).toBeNull();
  });

  it('tolerates a trailing slash and a lowercase method', () => {
    expect(genuineAuthRoute('post', '/api/v1/auth/login/')).toBe('/api/v1/auth/login');
  });

  // The gate returns a compile-time constant, never the caller's string: that is what keeps a
  // query string or an injected path segment out of the file.
  it('never echoes an unknown path back', () => {
    expect(genuineAuthRoute('POST', '/api/v1/auth/login/../../etc')).toBeNull();
    expect(genuineAuthRoute('POST', '/api/v1/auth/loginX')).toBeNull();
  });
});
