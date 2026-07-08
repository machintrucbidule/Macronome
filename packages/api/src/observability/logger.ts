import { pino } from 'pino';

// Structured logger. Credentials, session ids, and password/LLM fields are scrubbed
// so they never reach the logs (security.md §2, §7).
export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.body.password',
      'req.body.current_password',
      'req.body.new_password',
      'req.body.token',
      'password',
      'password_hash',
    ],
    remove: true,
  },
});
