import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRecord, type AuthFailureFacts } from './record.js';
import { appendAuthFailure, authFailureFilePaths, resetAuthFailureCounter } from './store.js';

// Same isolation pattern as config/session-secret.test.ts: a real temp dir via MACRONOME_DATA_DIR.
const PRIOR_DIR = process.env.MACRONOME_DATA_DIR;
let dir: string;

function record(ref: string) {
  const facts: AuthFailureFacts = {
    at: '2026-07-28T06:30:12.345Z',
    ref,
    route: '/api/v1/auth/login',
    method: 'POST',
    status: 401,
    errorCode: 'invalid_credentials',
    reqSecure: false,
    forwardedProto: null,
    peer: '127.0.0.1',
    peerTrusted: true,
    trustedProxy: 'loopback',
    cookieSecure: 'auto',
    cookies: ['macronome.csrf'],
    sessionFound: true,
    setCookies: ['macronome.csrf'],
  };
  return buildRecord(facts);
}

function lines(path: string): string[] {
  return readFileSync(path, 'utf8').trimEnd().split('\n');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'macronome-blackbox-'));
  process.env.MACRONOME_DATA_DIR = dir;
  resetAuthFailureCounter();
});

afterEach(() => {
  if (PRIOR_DIR === undefined) delete process.env.MACRONOME_DATA_DIR;
  else process.env.MACRONOME_DATA_DIR = PRIOR_DIR;
  rmSync(dir, { recursive: true, force: true });
  resetAuthFailureCounter();
});

describe('appendAuthFailure', () => {
  it('creates the file and appends one line per record', () => {
    const { current } = authFailureFilePaths();
    appendAuthFailure(record('AAAA-0001'));
    appendAuthFailure(record('AAAA-0002'));
    appendAuthFailure(record('AAAA-0003'));
    expect(lines(current)).toHaveLength(3);
    expect(readFileSync(current, 'utf8')).toContain('AAAA-0002');
  });

  it('rotates into a single archived generation when the bound is crossed', () => {
    const { current, archive } = authFailureFilePaths();
    for (let i = 0; i < 5; i += 1) appendAuthFailure(record(`AAAA-000${i}`), 3);
    expect(lines(archive)).toHaveLength(3);
    expect(lines(current)).toHaveLength(2);
  });

  // The bound must hold over time, not just once: a second rollover overwrites the archive rather
  // than growing a .2 generation, which is what keeps the footprint predictable.
  it('overwrites the archive on the next rotation, never a second generation', () => {
    const { current, archive } = authFailureFilePaths();
    for (let i = 0; i < 8; i += 1) appendAuthFailure(record(`AAAA-000${i}`), 3);
    expect(lines(archive)).toHaveLength(3);
    expect(lines(current)).toHaveLength(2);
    expect(existsSync(join(dir, 'auth_failures.2.jsonl'))).toBe(false);
    // The oldest records are gone; the newest are retained.
    expect(readFileSync(archive, 'utf8')).not.toContain('AAAA-0000');
    expect(readFileSync(current, 'utf8')).toContain('AAAA-0007');
  });

  // A black box that could turn a 401 into a 500 would be worse than none: the write must never
  // escalate into the request path.
  it('never throws when the data dir cannot be written', () => {
    process.env.MACRONOME_DATA_DIR = join(dir, 'a-file-not-a-dir');
    resetAuthFailureCounter();
    expect(() => appendAuthFailure(record('AAAA-0009'))).not.toThrow();
    // A subsequent good write still works (the counter re-syncs after a failure).
    process.env.MACRONOME_DATA_DIR = dir;
    resetAuthFailureCounter();
    expect(() => appendAuthFailure(record('AAAA-0010'))).not.toThrow();
    expect(lines(authFailureFilePaths().current)).toHaveLength(1);
  });

  // The dir is resolved per call precisely so a test (or a relocated volume) is honoured after the
  // module graph is already loaded.
  it('follows a relocated data dir', () => {
    appendAuthFailure(record('AAAA-0011'));
    const moved = mkdtempSync(join(tmpdir(), 'macronome-blackbox-moved-'));
    try {
      process.env.MACRONOME_DATA_DIR = moved;
      appendAuthFailure(record('AAAA-0012'));
      expect(lines(join(moved, 'auth_failures.jsonl'))).toHaveLength(1);
    } finally {
      rmSync(moved, { recursive: true, force: true });
    }
  });
});
