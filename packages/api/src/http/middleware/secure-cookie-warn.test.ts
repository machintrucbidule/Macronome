import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks: logger.warn spy + a mutable env whose COOKIE_SECURE each case can flip. Mocking
// config/env.js also avoids its self-load (DATABASE_URL) in the unit context.
const { warn, mockEnv } = vi.hoisted(() => ({
  warn: vi.fn(),
  mockEnv: { COOKIE_SECURE: true, TRUSTED_PROXY: 'loopback' },
}));
vi.mock('../../observability/logger.js', () => ({ logger: { warn } }));
vi.mock('../../config/env.js', () => ({ env: mockEnv }));

import { resetSecureCookieWarn, secureCookieWarn } from './secure-cookie-warn.js';

function run(secure: boolean): ReturnType<typeof vi.fn> {
  const next = vi.fn();
  secureCookieWarn({ secure } as Request, {} as Response, next);
  return next;
}

describe('secureCookieWarn', () => {
  afterEach(() => {
    warn.mockClear();
    resetSecureCookieWarn();
    mockEnv.COOKIE_SECURE = true;
  });

  it('warns once when COOKIE_SECURE=true and a request is insecure', () => {
    run(false);
    run(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn when the request is secure', () => {
    run(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when COOKIE_SECURE is false', () => {
    mockEnv.COOKIE_SECURE = false;
    resetSecureCookieWarn();
    run(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('always calls next()', () => {
    const next = run(false);
    expect(next).toHaveBeenCalledOnce();
  });
});
