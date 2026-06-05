import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import pg from 'pg';
import { env } from '../../config/env.js';
import { resolveSessionSecret } from '../../config/session-secret.js';

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
  cookie: {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: WEEK_MS,
  },
});
