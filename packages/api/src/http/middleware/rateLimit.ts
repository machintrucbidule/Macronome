import { rateLimit } from 'express-rate-limit';
import type { Request } from 'express';
import { ErrorCode } from '@macronome/shared';

// Login lockout keyed on (username, real client IP) — only failed attempts count
// (security.md §3). Exceeding the threshold → 429 locked_out with retry_after_s.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export const loginRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_FAILED_ATTEMPTS,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req: Request) => {
    const body = req.body as { username?: unknown } | undefined;
    const username = typeof body?.username === 'string' ? body.username.toLowerCase() : '';
    return `${username}|${req.ip ?? 'unknown'}`;
  },
  handler: (req, res) => {
    const info = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit;
    const resetMs = info?.resetTime?.getTime() ?? Date.now() + WINDOW_MS;
    const retryAfterS = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
    res.status(429).json({ error: { code: ErrorCode.LockedOut, retry_after_s: retryAfterS } });
  },
});
