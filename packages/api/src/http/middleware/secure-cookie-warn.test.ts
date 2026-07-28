import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks: logger.warn spy + a mutable env whose COOKIE_SECURE each case can flip. Mocking
// config/env.js also avoids its self-load (DATABASE_URL) in the unit context.
const { warn, mockEnv } = vi.hoisted(() => ({
  warn: vi.fn(),
  mockEnv: { COOKIE_SECURE: 'true', TRUSTED_PROXY: 'loopback' },
}));
vi.mock('../../observability/logger.js', () => ({ logger: { warn } }));
vi.mock('../../config/env.js', () => ({ env: mockEnv }));

import { resetSecureCookieWarn, secureCookieWarn } from './secure-cookie-warn.js';

const WINDOW_MS = 10 * 60 * 1000;

function run(secure: boolean): ReturnType<typeof vi.fn> {
  const next = vi.fn();
  secureCookieWarn({ secure } as Request, {} as Response, next);
  return next;
}

describe('secureCookieWarn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T06:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    warn.mockClear();
    resetSecureCookieWarn();
    mockEnv.COOKIE_SECURE = 'true';
  });

  it('warns when COOKIE_SECURE is forced to true and a request is insecure', () => {
    run(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst inside the window into one line', () => {
    run(false);
    run(false);
    run(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // B-231, prescribed work 3: the old one-shot latch could be consumed by an unrelated early
  // request and then never fire again. The gate must re-arm so a lasting misconfiguration keeps
  // being reported.
  it('warns again after the window elapses (the latch is gone)', () => {
    run(false);
    vi.advanceTimersByTime(WINDOW_MS);
    run(false);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('reports how many occurrences it suppressed', () => {
    run(false);
    run(false);
    run(false);
    vi.advanceTimersByTime(WINDOW_MS);
    run(false);
    expect(warn).toHaveBeenLastCalledWith(
      expect.objectContaining({ suppressed: 2, trustedProxy: 'loopback' }),
      expect.any(String),
    );
  });

  it('does not warn when the request is secure', () => {
    run(true);
    expect(warn).not.toHaveBeenCalled();
  });

  // With `auto` the derivation uses the same signal express-session gates emission on, so the trap
  // cannot arise — only an explicit force can produce it.
  it.each(['auto', 'false'])('does not warn when COOKIE_SECURE is %s', (mode) => {
    mockEnv.COOKIE_SECURE = mode;
    resetSecureCookieWarn();
    run(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('always calls next()', () => {
    const next = run(false);
    expect(next).toHaveBeenCalledOnce();
  });
});
