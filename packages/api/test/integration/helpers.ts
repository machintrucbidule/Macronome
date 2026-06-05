import argon2 from 'argon2';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/data/prisma.js';
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

export interface Authed {
  agent: Agent;
  csrf: string;
  userId: string;
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
  return { agent, csrf, userId: login.body.user.id as string };
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
