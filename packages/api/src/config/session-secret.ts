import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dataFilePath, resolveDataDir } from './data-dir.js';

// The session secret signs session cookies. To keep deployment zero-config (ADR-0001),
// it is auto-generated and persisted on first boot when SESSION_SECRET is not provided:
// a random secret is written under the app data dir (a mounted volume) and reused on
// every restart, so logins survive restarts. An explicit SESSION_SECRET (dev/CI, or an
// operator who wants to manage it) always takes precedence. Losing the file only forces
// a re-login; no user data depends on it.
const SECRET_FILE = 'session_secret';
const MIN_LEN = 16;

export function resolveSessionSecret(): string {
  const provided = process.env.SESSION_SECRET;
  if (provided && provided.length >= MIN_LEN) return provided;
  const dir = resolveDataDir();
  const path = dataFilePath(SECRET_FILE);
  if (existsSync(path)) return readFileSync(path, 'utf8').trim();
  const secret = randomBytes(48).toString('base64url');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, secret, { mode: 0o600 });
  return secret;
}
