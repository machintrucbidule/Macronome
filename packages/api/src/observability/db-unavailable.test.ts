import { describe, expect, it } from 'vitest';
import { isDatabaseUnavailable } from './db-unavailable.js';

// B-231 hardening: a lost connection must be recognisable so it answers 503 database_unavailable
// instead of a generic 500 that reads as a bug. The shapes below are what Prisma and pg actually
// throw; the negative cases matter just as much — misclassifying a real bug as "retry later" would
// hide it.
describe('isDatabaseUnavailable', () => {
  it('recognises a Prisma initialisation failure by name', () => {
    const err = Object.assign(new Error("Can't reach database server"), {
      name: 'PrismaClientInitializationError',
    });
    expect(isDatabaseUnavailable(err)).toBe(true);
  });

  it.each(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])(
    'recognises the Prisma connectivity code %s',
    (code) => {
      expect(isDatabaseUnavailable(Object.assign(new Error('db'), { code }))).toBe(true);
    },
  );

  it.each(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'])(
    'recognises the socket errno %s',
    (code) => {
      expect(isDatabaseUnavailable(Object.assign(new Error('socket'), { code }))).toBe(true);
    },
  );

  // 57P03 is what a Postgres instance still in crash recovery answers — the shape a host reboot
  // produces, and the one that must never read as an application bug.
  it.each(['08006', '08003', '57P01', '57P02', '57P03', '53300'])(
    'recognises the Postgres SQLSTATE %s',
    (code) => {
      expect(isDatabaseUnavailable(Object.assign(new Error('pg'), { code }))).toBe(true);
    },
  );

  it('recognises the pg pool teardown, which carries no code', () => {
    expect(isDatabaseUnavailable(new Error('Connection terminated unexpectedly'))).toBe(true);
  });

  it('does not misclassify an ordinary application error', () => {
    expect(isDatabaseUnavailable(new Error('cannot read property of undefined'))).toBe(false);
    expect(isDatabaseUnavailable(Object.assign(new Error('nope'), { code: 'P2002' }))).toBe(false);
  });

  it('handles non-objects without throwing', () => {
    expect(isDatabaseUnavailable(null)).toBe(false);
    expect(isDatabaseUnavailable(undefined)).toBe(false);
    expect(isDatabaseUnavailable('ECONNREFUSED')).toBe(false);
  });
});
