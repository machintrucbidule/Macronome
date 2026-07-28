import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dataFilePath, resolveDataDir } from '../../config/data-dir.js';
import { logger } from '../logger.js';
import { createThrottle } from '../warn-throttle.js';
import { serializeRecord, type AuthBlackBoxRecord } from './record.js';
import { countLines, shouldRotate, MAX_RECORDS } from './retention.js';

// The fs shell of the black box (B-231). Appends one line per failed authentication attempt to the
// app data volume, so the evidence outlives the container recreation that "fixing" such an outage
// requires — ordinary logs do not.
//
// Sync fs on purpose: this runs from `res.on('finish')`, off the request's critical path, matches
// config/session-secret.ts, and keeps write ordering deterministic for the integration assertions.
// An append plus an in-memory line counter keeps a login flood at O(1) per record.
const CURRENT_FILE = 'auth_failures.jsonl';
const ARCHIVE_FILE = 'auth_failures.1.jsonl';
const FILE_MODE = 0o600;
const ERROR_WARN_INTERVAL_MS = 10 * 60 * 1000;

const errorGate = createThrottle(ERROR_WARN_INTERVAL_MS);

// Cached per resolved directory. resolveDataDir() is read on every call (tests relocate it after
// the module graph is loaded), so a directory change must invalidate the counter.
let countedDir: string | null = null;
let lines = 0;

export function authFailureFilePaths(): { current: string; archive: string } {
  return { current: dataFilePath(CURRENT_FILE), archive: dataFilePath(ARCHIVE_FILE) };
}

function syncCounter(dir: string, current: string): void {
  if (countedDir === dir) return;
  mkdirSync(dir, { recursive: true });
  lines = existsSync(current) ? countLines(readFileSync(current, 'utf8')) : 0;
  countedDir = dir;
}

function rotate(current: string, archive: string): void {
  // rmSync first: renameSync onto an existing target throws on Windows. No-op elsewhere.
  rmSync(archive, { force: true });
  renameSync(current, archive);
  lines = 0;
}

/**
 * Append one record. Never throws and never blocks the response: a black box that could turn a
 * 401 into a 500 would be worse than no black box at all.
 */
export function appendAuthFailure(record: AuthBlackBoxRecord, max: number = MAX_RECORDS): void {
  try {
    const dir = resolveDataDir();
    const { current, archive } = authFailureFilePaths();
    syncCounter(dir, current);
    if (shouldRotate(lines, max) && existsSync(current)) rotate(current, archive);
    appendFileSync(current, serializeRecord(record), { mode: FILE_MODE });
    lines += 1;
  } catch (err) {
    // Re-sync on the next call; the failure itself is throttled so a broken volume cannot flood.
    countedDir = null;
    if (errorGate.allow(Date.now())) {
      logger.warn(
        { err, suppressed: errorGate.drain(), dir: resolveDataDir() },
        'could not write the authentication black box; login diagnostics will be unavailable',
      );
    }
  }
}

/** Test-only: forget the cached line count so a relocated data dir is re-read. */
export function resetAuthFailureCounter(): void {
  countedDir = null;
  lines = 0;
}
