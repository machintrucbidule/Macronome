import { join } from 'node:path';

// Single authority for the app data directory: the mounted volume holding the files that must
// outlive a container recreation — the auto-generated session secret (config/session-secret.ts)
// and the authentication black box (observability/auth-blackbox, B-231). ops.md §4.
//
// Resolved LAZILY on every call, never cached: tests point MACRONOME_DATA_DIR at a temp dir after
// the module graph is already loaded (createApp() is imported at module scope), so an eager read
// would freeze the wrong value.
const DEFAULT_DIR = '/data';

export function resolveDataDir(): string {
  return process.env.MACRONOME_DATA_DIR ?? DEFAULT_DIR;
}

export function dataFilePath(name: string): string {
  return join(resolveDataDir(), name);
}
