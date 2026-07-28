import { describe, expect, it } from 'vitest';
import { cookieNamesFromHeader, rawCookieValue, setCookieNames } from './cookie-names.js';

const HEADER = 'macronome.sid=s%3Aabc.def; macronome.csrf=deadbeef; other=1';

// security.md §7: names only. The assertions below are the leak guard — no `=` and no fragment of
// any value may survive into what gets written to disk.
describe('cookieNamesFromHeader', () => {
  it('extracts names and never a value', () => {
    const names = cookieNamesFromHeader(HEADER);
    expect(names).toEqual(['macronome.csrf', 'macronome.sid', 'other']);
    for (const name of names) expect(name).not.toContain('=');
    expect(names.join(',')).not.toContain('deadbeef');
    expect(names.join(',')).not.toContain('abc');
  });

  it('returns nothing for an absent or empty header', () => {
    expect(cookieNamesFromHeader(undefined)).toEqual([]);
    expect(cookieNamesFromHeader('')).toEqual([]);
  });

  it('drops names outside the cookie token charset', () => {
    expect(cookieNamesFromHeader('bad name=1; "quoted"=2; ok=3')).toEqual(['ok']);
  });

  it('dedupes and caps the list so a hostile client cannot bloat a record', () => {
    const many = Array.from({ length: 100 }, (_, i) => `c${i}=1`).join('; ');
    expect(cookieNamesFromHeader(many)).toHaveLength(32);
    expect(cookieNamesFromHeader('a=1; a=2')).toEqual(['a']);
  });

  it('clamps an absurdly long name', () => {
    const [name] = cookieNamesFromHeader(`${'x'.repeat(500)}=1`);
    expect(name).toHaveLength(64);
  });
});

describe('setCookieNames', () => {
  it('handles the array form Express uses for several cookies', () => {
    expect(
      setCookieNames(['macronome.sid=s%3Aabc; Path=/; Secure', 'macronome.csrf=beef; Path=/']),
    ).toEqual(['macronome.csrf', 'macronome.sid']);
  });

  it('handles the single-string form and an absent header', () => {
    expect(setCookieNames('macronome.csrf=beef; Path=/')).toEqual(['macronome.csrf']);
    expect(setCookieNames(undefined)).toEqual([]);
    expect(setCookieNames(42)).toEqual([]);
  });
});

describe('rawCookieValue', () => {
  it('finds the signed session cookie', () => {
    expect(rawCookieValue(HEADER, 'macronome.sid')).toBe('s%3Aabc.def');
  });

  it('returns undefined when absent, and does not match a name prefix', () => {
    expect(rawCookieValue(HEADER, 'macronome.si')).toBeUndefined();
    expect(rawCookieValue(undefined, 'macronome.sid')).toBeUndefined();
  });
});
