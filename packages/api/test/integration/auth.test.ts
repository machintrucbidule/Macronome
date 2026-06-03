import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';

// Integration contract checks for the auth resource (spec/api/00-conventions.md §7,
// testing.md §2). Runs against the compose.test.yml Postgres (npm run db:dev).
const app = createApp();

function getCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  if (!raw) return undefined;
  const escaped = name.replace(/\./g, '\\.');
  for (const cookie of raw) {
    const match = new RegExp(`${escaped}=([^;]+)`).exec(cookie);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return undefined;
}

async function seedUser(username: string, password: string): Promise<void> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.appUser.create({
    data: {
      username: username.toLowerCase(),
      passwordHash,
      sex: 'male',
      birthdate: new Date('1990-01-01'),
      heightCm: 180,
    },
  });
}

/** A cookie-persisting agent primed with a CSRF token (from a first GET). */
async function csrfAgent(): Promise<{ agent: ReturnType<typeof request.agent>; csrf: string }> {
  const agent = request.agent(app);
  const pre = await agent.get('/api/v1/auth/session');
  return { agent, csrf: getCookie(pre, 'macronome.csrf') ?? '' };
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('auth', () => {
  it('returns 401 invalid_credentials for a wrong password', async () => {
    await seedUser('alice', 'correct-horse');
    const { agent, csrf } = await csrfAgent();
    const res = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf)
      .send({ username: 'alice', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'invalid_credentials' } });
  });

  it('returns the same 401 body for an unknown user (non-enumerating)', async () => {
    const { agent, csrf } = await csrfAgent();
    const res = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf)
      .send({ username: 'ghost', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'invalid_credentials' } });
  });

  it('logs in, sets a session cookie, and returns the user from /session', async () => {
    await seedUser('alice', 'correct-horse');
    const { agent, csrf } = await csrfAgent();

    const login = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrf)
      .send({ username: 'alice', password: 'correct-horse' });

    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ username: 'alice', locale: 'fr', theme: 'dark' });
    expect(getCookie(login, 'macronome.sid')).toBeTruthy();

    const session = await agent.get('/api/v1/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.user.username).toBe('alice');
  });

  it('returns 429 locked_out with retry_after_s after too many failed attempts', async () => {
    await seedUser('bob', 'correct-horse');
    const { agent, csrf } = await csrfAgent();

    let last: request.Response | undefined;
    for (let i = 0; i < 6; i += 1) {
      last = await agent
        .post('/api/v1/auth/login')
        .set('x-csrf-token', csrf)
        .send({ username: 'bob', password: 'wrong' });
    }

    expect(last?.status).toBe(429);
    expect(last?.body.error.code).toBe('locked_out');
    expect(typeof last?.body.error.retry_after_s).toBe('number');
  });

  it('rejects a state-changing request without a CSRF token (403)', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/v1/auth/login')
      .send({ username: 'alice', password: 'correct-horse' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('csrf_invalid');
  });
});
