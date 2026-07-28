import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import {
  appendAuthFailure,
  buildRecord,
  MAX_RECORDS,
} from '../../src/observability/auth-blackbox/index.js';
import {
  clearBlackBox,
  cookieHeader,
  getCookie,
  readBlackBox,
  readBlackBoxText,
} from './helpers.js';

// The authentication black box (B-231): one durable record per FAILED genuine authentication
// attempt, in the app data volume, so the evidence survives the container recreation that "fixing"
// such an outage requires. The data dir is redirected to test/.tmp-data by the integration config.
// Each case uses its own username: the login rate-limiter's store is in-memory and keyed on
// (username, IP), so it survives the DB truncation between cases.
const app = createApp();
const PASSWORD = 'correct-horse';
const WRONG_PASSWORD = 'wrong-horse-battery';
const REF_SHAPE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

const EXPECTED_KEYS = [
  'at',
  'ref',
  'route',
  'method',
  'status',
  'error_code',
  'req_secure',
  'x_forwarded_proto',
  'peer',
  'peer_trusted',
  'trusted_proxy',
  'cookie_secure',
  'cookies',
  'session_found',
  'set_cookie',
  'set_cookies',
];

async function seedUser(username: string): Promise<void> {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  await prisma.appUser.create({
    data: {
      username,
      passwordHash,
      sex: 'male',
      birthdate: new Date('1986-01-01'),
      heightCm: 180,
    },
  });
}

/** Prime the CSRF cookie the way the SPA does on load. */
function prime() {
  return request(app).get('/api/v1/auth/session');
}

function postLogin(pre: request.Response, username: string, password: string) {
  return request(app)
    .post('/api/v1/auth/login')
    .set('Cookie', cookieHeader(pre))
    .set('x-csrf-token', getCookie(pre, 'macronome.csrf') ?? '')
    .send({ username, password });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
  clearBlackBox();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('authentication black box — what gets recorded', () => {
  it('writes exactly one record for a failed login, with the documented fields', async () => {
    await seedUser('bb-fields');
    const pre = await prime();
    const res = await postLogin(pre, 'bb-fields', WRONG_PASSWORD);
    expect(res.status).toBe(401);

    const records = readBlackBox();
    expect(records).toHaveLength(1);
    expect(Object.keys(records[0]!)).toEqual(EXPECTED_KEYS);
    expect(records[0]).toMatchObject({
      route: '/api/v1/auth/login',
      method: 'POST',
      status: 401,
      error_code: 'invalid_credentials',
      req_secure: false,
      x_forwarded_proto: null,
      cookie_secure: 'auto',
      trusted_proxy: 'loopback',
      session_found: true, // the priming GET created one
      set_cookie: true,
    });
    expect(records[0]!.cookies).toContain('macronome.sid');
    expect(records[0]!.cookies).toContain('macronome.csrf');
    expect(records[0]!.ref).toMatch(REF_SHAPE);
  });

  // The reason this file may live on disk at all (security.md §7). If this ever fails, the black box
  // has become a credential leak and must not ship.
  it('leaks no secret: no username, password, token, session id or session secret', async () => {
    await seedUser('bb-secrets');
    const pre = await prime();
    const csrfToken = getCookie(pre, 'macronome.csrf') ?? '';
    const sid = getCookie(pre, 'macronome.sid') ?? '';
    await postLogin(pre, 'bb-secrets', WRONG_PASSWORD);

    const text = readBlackBoxText();
    expect(text).not.toContain('bb-secrets');
    expect(text).not.toContain(WRONG_PASSWORD);
    expect(text).not.toContain(PASSWORD);
    expect(csrfToken).not.toBe('');
    expect(text).not.toContain(csrfToken);
    expect(sid).not.toBe('');
    expect(text).not.toContain(sid.replace(/^s:/, '').split('.')[0]);
    expect(text).not.toContain(process.env.SESSION_SECRET ?? 'unset-secret');
  });

  it('returns the same ref in the error envelope as in the record', async () => {
    await seedUser('bb-ref');
    const pre = await prime();
    const res = await postLogin(pre, 'bb-ref', WRONG_PASSWORD);

    expect(res.body.error.ref).toMatch(REF_SHAPE);
    expect(readBlackBox()[0]!.ref).toBe(res.body.error.ref);
  });

  it('records a CSRF rejection distinctly, with no session found', async () => {
    await seedUser('bb-csrf');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'bb-csrf', password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_invalid');
    expect(res.body.error.ref).toMatch(REF_SHAPE);
    const [record] = readBlackBox();
    expect(record).toMatchObject({
      status: 403,
      error_code: 'csrf_invalid',
      session_found: false,
      set_cookie: true,
    });
    expect(record!.set_cookies).toContain('macronome.csrf');
  });

  it('records a lockout, which writes its 429 without going through the error handler', async () => {
    await seedUser('bb-lockout');
    const pre = await prime();
    let last = await postLogin(pre, 'bb-lockout', WRONG_PASSWORD);
    for (let i = 0; i < 5; i += 1) last = await postLogin(pre, 'bb-lockout', WRONG_PASSWORD);

    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('locked_out');
    expect(last.body.error.retry_after_s).toBeGreaterThan(0);
    expect(last.body.error.ref).toMatch(REF_SHAPE);
    const records = readBlackBox();
    expect(records.at(-1)).toMatchObject({ status: 429, error_code: 'locked_out' });
    expect(records.at(-1)!.ref).toBe(last.body.error.ref);
  });
});

describe('authentication black box — what does NOT get recorded', () => {
  it('ignores a successful login', async () => {
    await seedUser('bb-success');
    const pre = await prime();
    const res = await postLogin(pre, 'bb-success', PASSWORD);

    expect(res.status).toBe(200);
    expect(readBlackBox()).toHaveLength(0);
  });

  // The SPA probes /auth/session on every page load and gets a 401 whenever nobody is signed in.
  // Recording that would bury the anomaly under normal traffic — which is the whole failure mode
  // this file exists to avoid.
  it('ignores the routine session probe and the other non-attempt auth routes', async () => {
    const probe = await request(app).get('/api/v1/auth/session');
    expect(probe.status).toBe(401);
    expect(probe.body.error.ref).toBeUndefined();

    await request(app).get('/api/v1/auth/setup-state');
    await request(app).post('/api/v1/auth/token-state').send({ token: 'nope' });
    await request(app).post('/api/v1/auth/logout');

    expect(readBlackBox()).toHaveLength(0);
  });
});

describe('authentication black box — bounding', () => {
  // Written through the store directly: the HTTP path is covered above, this case is about the file
  // staying bounded no matter how many attempts arrive.
  it('keeps one archived generation and never a third file', () => {
    const bound = 5;
    for (let i = 0; i < bound * 2 + 2; i += 1) {
      appendAuthFailure(
        buildRecord({
          at: new Date().toISOString(),
          ref: `AAAA-00${String(i).padStart(2, '0')}`,
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
          cookies: [],
          sessionFound: false,
          setCookies: [],
        }),
        bound,
      );
    }

    expect(readBlackBox().length).toBeLessThanOrEqual(bound);
    expect(MAX_RECORDS).toBe(500);
  });
});
