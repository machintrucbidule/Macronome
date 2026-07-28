import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cookieHeader, getCookie, getSetCookie } from './helpers.js';

// B-232: `COOKIE_SECURE=false` must still mean "never Secure" — this is the lever the owner reached
// for twice to unblock a login, so the derivation must not have quietly taken it away.
//
// The mode is set BEFORE importing the app: config/env.ts reads process.env at import time, and
// vitest gives each test file its own module registry (fileParallelism is off), so this file runs
// the app in `false` mode while the rest of the suite runs the default `auto`.
process.env.COOKIE_SECURE = 'false';
const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/data/prisma.js');

const app = createApp();
const PASSWORD = 'correct-horse';

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('COOKIE_SECURE=false — the unblocking lever', () => {
  it('never marks the cookies Secure, even behind an HTTPS hop', async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    await prisma.appUser.create({
      data: {
        username: 'lever',
        passwordHash,
        sex: 'male',
        birthdate: new Date('1986-01-01'),
        heightCm: 180,
      },
    });

    const pre = await request(app).get('/api/v1/auth/session').set('X-Forwarded-Proto', 'https');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .set('Cookie', cookieHeader(pre))
      .set('x-csrf-token', getCookie(pre, 'macronome.csrf') ?? '')
      .send({ username: 'lever', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(getSetCookie(res, 'macronome.sid')).toBeDefined();
    expect(getSetCookie(res, 'macronome.sid')).not.toContain('Secure');
    expect(getSetCookie(pre, 'macronome.csrf')).not.toContain('Secure');
  });
});
