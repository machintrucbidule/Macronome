import { describe, expect, it } from 'vitest';
import { buildRecord, RECORD_KEYS, serializeRecord, type AuthFailureFacts } from './record.js';

function facts(overrides: Partial<AuthFailureFacts> = {}): AuthFailureFacts {
  return {
    at: '2026-07-28T06:30:12.345Z',
    ref: 'K7QM-3ZP2',
    route: '/api/v1/auth/login',
    method: 'POST',
    status: 403,
    errorCode: 'csrf_invalid',
    reqSecure: false,
    forwardedProto: 'https',
    peer: '::ffff:192.168.192.1',
    peerTrusted: true,
    trustedProxy: 'loopback, uniquelocal',
    cookieSecure: 'auto',
    cookies: ['macronome.csrf'],
    sessionFound: false,
    setCookies: ['macronome.csrf'],
    ...overrides,
  };
}

describe('buildRecord', () => {
  // THE leak guard. This record is written to disk, so a field must not be addable in silence:
  // any new key has to be declared here deliberately, with the reviewer forced to ask "can this
  // carry a credential?". security.md §7.
  it('emits exactly the declared key set, in order', () => {
    expect(Object.keys(buildRecord(facts()))).toEqual([...RECORD_KEYS]);
  });

  it('maps the facts to the documented field names', () => {
    expect(buildRecord(facts())).toMatchObject({
      ref: 'K7QM-3ZP2',
      route: '/api/v1/auth/login',
      status: 403,
      error_code: 'csrf_invalid',
      req_secure: false,
      x_forwarded_proto: 'https',
      peer_trusted: true,
      cookie_secure: 'auto',
      session_found: false,
      set_cookie: true,
      set_cookies: ['macronome.csrf'],
    });
  });

  it('derives set_cookie from whether any cookie was emitted', () => {
    expect(buildRecord(facts({ setCookies: [] })).set_cookie).toBe(false);
  });

  // The B-222 signature the operator is told to look for in ops.md §6b.
  it('records the refused-cookie signature distinctly', () => {
    const record = buildRecord(
      facts({ reqSecure: false, cookieSecure: 'true', setCookies: [], sessionFound: false }),
    );
    expect(record).toMatchObject({ req_secure: false, cookie_secure: 'true', set_cookie: false });
  });

  it('carries an unknown session state as null rather than guessing', () => {
    expect(buildRecord(facts({ sessionFound: null })).session_found).toBeNull();
  });

  it('clamps attacker-influenced strings', () => {
    const record = buildRecord(facts({ forwardedProto: 'h'.repeat(500), peer: 'p'.repeat(500) }));
    expect(record.x_forwarded_proto).toHaveLength(64);
    expect(record.peer).toHaveLength(64);
  });
});

describe('serializeRecord', () => {
  it('writes one line, newline-terminated', () => {
    const line = serializeRecord(buildRecord(facts()));
    expect(line.endsWith('\n')).toBe(true);
    expect(line.slice(0, -1)).not.toContain('\n');
  });

  // A crafted value must not be able to forge an extra record: JSON escaping keeps it on one line.
  it('escapes control characters so a crafted value cannot forge a second record', () => {
    const line = serializeRecord(buildRecord(facts({ forwardedProto: 'https\n{"ref":"FAKE"}' })));
    expect(line.slice(0, -1)).not.toContain('\n');
    expect(JSON.parse(line) as { x_forwarded_proto: string }).toBeTruthy();
  });

  it('round-trips as JSON', () => {
    const record = buildRecord(facts());
    expect(JSON.parse(serializeRecord(record))).toEqual(record);
  });
});
