import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import pg from 'pg';
import { env } from '../../config/env.js';
import { resolveSessionSecret } from '../../config/session-secret.js';
import { deriveCookieSecure } from '../cookie-secure.js';

// Server-side opaque sessions stored in PostgreSQL (security.md §1). The cookie
// carries only the session id; revocation = deleting the row. "Stay signed in"
// extends maxAge at login (controller).
const PgStore = connectPgSimple(session);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

export const sessionMiddleware = session({
  store: new PgStore({ pool, tableName: 'session', createTableIfMissing: false }),
  name: 'macronome.sid',
  secret: resolveSessionSecret(),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  // `cookie` as a function of the request so `Secure` is derived per request (B-232). This branch
  // covers NEW sessions only — express-session calls it from generate(); sessions loaded from the
  // store keep their frozen attributes, which session-cookie-secure.ts corrects afterwards.
  cookie: (req) => ({
    httpOnly: true,
    secure: deriveCookieSecure(env.COOKIE_SECURE, req.secure === true),
    sameSite: 'lax',
    path: '/',
    maxAge: WEEK_MS,
  }),
});

/** Cookie attributes to mirror when clearing the session cookie (logout). */
export function sessionCookieOptions(reqSecure: boolean) {
  return {
    httpOnly: true,
    secure: deriveCookieSecure(env.COOKIE_SECURE, reqSecure),
    sameSite: 'lax' as const,
    path: '/',
  };
}
