import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { cookieHeader, getCookie, getSetCookie } from './helpers.js';

// B-232: `Secure` is derived per request. COOKIE_SECURE=auto (the production default, set in
// vitest.integration.config.ts) means the attribute follows whether the server sees the request as
// HTTPS. TRUSTED_PROXY=loopback + supertest connecting from 127.0.0.1 means X-Forwarded-Proto is
// honoured, so an HTTPS hop can be simulated.
//
// Cookies are carried by hand rather than by a supertest agent: the agent's jar will not store a
// Secure cookie over the test's plain-HTTP socket, which would drop the session mid-flow.
const app = createApp();
const PASSWORD = 'correct-horse';

async function seedUser(username: string): Promise<void> {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  await prisma.appUser.create({
    data: { username, passwordHash, sex: 'male', birthdate: new Date('1986-01-01'), heightCm: 180 },
  });
}

/** Prime the CSRF cookie, then log in — optionally declaring an upstream HTTPS hop. */
async function login(username: string, https: boolean) {
  const proto = https ? 'https' : 'http';
  const pre = await request(app).get('/api/v1/auth/session').set('X-Forwarded-Proto', proto);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('X-Forwarded-Proto', proto)
    .set('Cookie', cookieHeader(pre))
    .set('x-csrf-token', getCookie(pre, 'macronome.csrf') ?? '')
    .send({ username, password: PASSWORD });
  return { pre, res };
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('COOKIE_SECURE=auto — session & CSRF cookie Secure derivation', () => {
  // The B-222 regression guard: plain HTTP must never produce a Secure cookie, because
  // express-session would then refuse to emit it and login would fail with a misleading 403.
  it('logs in over plain HTTP and emits the cookies WITHOUT Secure', async () => {
    await seedUser('plain');
    const { pre, res } = await login('plain', false);

    expect(res.status).toBe(200);
    expect(getSetCookie(res, 'macronome.sid')).toBeDefined();
    expect(getSetCookie(res, 'macronome.sid')).not.toContain('Secure');
    expect(getSetCookie(pre, 'macronome.csrf')).not.toContain('Secure');
  });

  // The positive half of B-232, previously untested: the hardening switches itself on.
  it('logs in behind an HTTPS hop and marks BOTH cookies Secure', async () => {
    await seedUser('secure');
    const { pre, res } = await login('secure', true);

    expect(res.status).toBe(200);
    expect(getSetCookie(res, 'macronome.sid')).toContain('Secure');
    expect(getSetCookie(pre, 'macronome.csrf')).toContain('Secure');
  });

  // The case express-session's own `secure:'auto'` cannot handle: a loaded session restores its
  // cookie attributes frozen from the stored row, so without applySessionCookieSecure this session
  // would stay non-Secure for its whole week.
  it('upgrades a session created over HTTP to Secure on a later HTTPS request', async () => {
    await seedUser('upgraded');
    const { pre, res } = await login('upgraded', false);
    expect(getSetCookie(res, 'macronome.sid')).not.toContain('Secure');

    const later = await request(app)
      .get('/api/v1/auth/session')
      .set('X-Forwarded-Proto', 'https')
      .set('Cookie', cookieHeader(pre, res));

    expect(later.status).toBe(200);
    expect(getSetCookie(later, 'macronome.sid')).toContain('Secure');
    expect(getSetCookie(later, 'macronome.csrf')).toContain('Secure');
  });

  it('keeps the other cookie attributes intact', async () => {
    await seedUser('attrs');
    const { res } = await login('attrs', true);
    const sid = getSetCookie(res, 'macronome.sid') ?? '';

    expect(sid).toContain('HttpOnly');
    expect(sid).toContain('SameSite=Lax');
    expect(sid).toContain('Path=/');
  });
});
