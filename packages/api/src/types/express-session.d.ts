import 'express-session';

// Server-side session payload (opaque cookie carries only the session id).
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
  }
}
