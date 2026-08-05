import { existsSync, readFileSync, rmSync } from 'node:fs';
import argon2 from 'argon2';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/data/prisma.js';
import {
  authFailureFilePaths,
  resetAuthFailureCounter,
  type AuthBlackBoxRecord,
} from '../../src/observability/auth-blackbox/index.js';
import { seedDefaultsForUser } from '../../src/services/user-bootstrap.js';

// Shared integration helpers (testing.md §2): cookie extraction, an authed cookie-primed
// agent, and direct row seeders for prerequisites built in earlier milestones (target,
// weight, food). Runs against the compose.test.yml Postgres.

export type Agent = ReturnType<typeof request.agent>;

export function getCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  if (!raw) return undefined;
  const escaped = name.replace(/\./g, '\\.');
  for (const cookie of raw) {
    const match = new RegExp(`${escaped}=([^;]+)`).exec(cookie);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return undefined;
}

/** The full `Set-Cookie` string for one cookie, so attributes (Secure, SameSite…) can be asserted. */
export function getSetCookie(res: request.Response, name: string): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((cookie) => cookie.startsWith(`${name}=`));
}

/**
 * Re-present the cookies a response set, as a request `Cookie` header. Needed whenever a case
 * simulates HTTPS via `X-Forwarded-Proto`: supertest's cookie jar refuses to store a `Secure`
 * cookie over the test's plain-HTTP socket, so an agent would silently drop the session. A real
 * browser on a real HTTPS proxy keeps it — this models that.
 */
export function cookieHeader(...responses: request.Response[]): string {
  const pairs = new Map<string, string>();
  for (const res of responses) {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    for (const cookie of raw ?? []) {
      const pair = cookie.split(';')[0] ?? '';
      const name = pair.split('=')[0];
      if (name) pairs.set(name, pair);
    }
  }
  return [...pairs.values()].join('; ');
}

/** Raw text of the authentication black box (B-231) — for the no-secrets assertions. */
export function readBlackBoxText(): string {
  const { current } = authFailureFilePaths();
  return existsSync(current) ? readFileSync(current, 'utf8') : '';
}

/** Parsed black-box records, oldest first. */
export function readBlackBox(): AuthBlackBoxRecord[] {
  const text = readBlackBoxText().trimEnd();
  if (text === '') return [];
  return text.split('\n').map((line) => JSON.parse(line) as AuthBlackBoxRecord);
}

/** Remove both black-box generations so a case starts from an empty file. */
export function clearBlackBox(): void {
  const { current, archive } = authFailureFilePaths();
  rmSync(current, { force: true });
  rmSync(archive, { force: true });
  resetAuthFailureCounter(); // the store caches the line count; deleting the file invalidates it
}

export interface Authed {
  agent: Agent;
  csrf: string;
  userId: string;
  /**
   * The session + CSRF cookies as a request `Cookie` header. Pass it explicitly on any request
   * that simulates HTTPS with `X-Forwarded-Proto`: the response then carries a `Secure` session
   * cookie (B-232), which the agent's jar will not hand back over the test's plain-HTTP socket.
   */
  cookies: string;
}

/** Seed a user, log them in, return a cookie-primed agent + CSRF token + id. */
export async function authedAgent(app: Express, username: string): Promise<Authed> {
  const passwordHash = await argon2.hash('correct-horse', { type: argon2.argon2id });
  const created = await prisma.appUser.create({
    data: { username, passwordHash, sex: 'male', birthdate: new Date('1986-01-01'), heightCm: 180 },
    select: { id: true },
  });
  await seedDefaultsForUser(created.id); // default meal template + locked built-in "Rien"
  const agent = request.agent(app);
  const pre = await agent.get('/api/v1/auth/session');
  const csrf = getCookie(pre, 'macronome.csrf') ?? '';
  const login = await agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', csrf)
    .send({ username, password: 'correct-horse' });
  return {
    agent,
    csrf,
    userId: login.body.user.id as string,
    cookies: cookieHeader(pre, login),
  };
}

/** A target row (M2) so days resolve a non-degenerate calorie snapshot. */
export function seedTarget(
  userId: string,
  effectiveFrom: string,
  calorieMin = 1900,
  calorieMax = 2100,
): Promise<unknown> {
  return prisma.target.create({
    data: {
      userId,
      calorieMin,
      calorieMax,
      proteinGPerKg: 1.8,
      fatGPerKg: 0.8,
      effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
    },
  });
}

/** A weigh-in (M2 table) so floors/constat are computable on the day. */
export function seedWeight(userId: string, date: string, weightKg: number): Promise<unknown> {
  return prisma.weightEntry.create({
    data: { userId, date: new Date(`${date}T00:00:00.000Z`), weightKg, dietFlag: 'in_diet' },
  });
}

/** A catalog food (M1) to log. Default macros are round numbers for easy oracles. */
export function seedFood(
  userId: string,
  name: string,
  per100g = { kcal: 200, fat: 10, carb: 20, protein: 5 },
): Promise<{ id: string }> {
  return prisma.food.create({
    data: {
      ownerId: userId,
      name,
      normalizedName: name.toLowerCase(),
      kcalPer100g: per100g.kcal,
      fatPer100g: per100g.fat,
      carbPer100g: per100g.carb,
      proteinPer100g: per100g.protein,
    },
    select: { id: true },
  });
}

/** A tare container (M3 reads it; full Contenants CRUD is M7). */
export function seedContainer(
  userId: string,
  name: string,
  emptyWeightG: number,
): Promise<{ id: string }> {
  return prisma.container.create({
    data: { ownerId: userId, name, normalizedName: name.toLowerCase(), emptyWeightG },
    select: { id: true },
  });
}

export function csrfPost(agent: Agent, csrf: string, url: string, body?: Record<string, unknown>) {
  return agent
    .post(url)
    .set('x-csrf-token', csrf)
    .send(body ?? {});
}

export function csrfPatch(agent: Agent, csrf: string, url: string, body: Record<string, unknown>) {
  return agent.patch(url).set('x-csrf-token', csrf).send(body);
}

export function csrfDelete(agent: Agent, csrf: string, url: string) {
  return agent.delete(url).set('x-csrf-token', csrf);
}
