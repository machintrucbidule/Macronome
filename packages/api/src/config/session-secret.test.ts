import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveSessionSecret } from './session-secret.js';

const PRIOR_SECRET = process.env.SESSION_SECRET;
const PRIOR_DIR = process.env.MACRONOME_DATA_DIR;

describe('resolveSessionSecret', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'macronome-secret-'));
    process.env.MACRONOME_DATA_DIR = dir;
    delete process.env.SESSION_SECRET;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (PRIOR_SECRET === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = PRIOR_SECRET;
    if (PRIOR_DIR === undefined) delete process.env.MACRONOME_DATA_DIR;
    else process.env.MACRONOME_DATA_DIR = PRIOR_DIR;
  });

  it('uses an explicit SESSION_SECRET and writes no file', () => {
    process.env.SESSION_SECRET = 'an-explicit-secret-value';
    expect(resolveSessionSecret()).toBe('an-explicit-secret-value');
    expect(existsSync(join(dir, 'session_secret'))).toBe(false);
  });

  it('generates and persists a secret when none is provided', () => {
    const secret = resolveSessionSecret();
    expect(secret.length).toBeGreaterThanOrEqual(16);
    expect(readFileSync(join(dir, 'session_secret'), 'utf8')).toBe(secret);
  });

  it('reuses the persisted secret on the next call', () => {
    const first = resolveSessionSecret();
    expect(resolveSessionSecret()).toBe(first);
  });

  it('ignores a too-short SESSION_SECRET and generates instead', () => {
    process.env.SESSION_SECRET = 'short';
    const secret = resolveSessionSecret();
    expect(secret).not.toBe('short');
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });
});
