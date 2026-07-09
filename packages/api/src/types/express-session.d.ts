import 'express-session';

// Server-side session payload (opaque cookie carries only the session id).
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    csrfToken?: string;
    /** One-time Google Drive OAuth anti-forgery state (B-208), set at /connect. */
    oauthState?: { value: string; expiresAt: number };
  }
}
