import argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';

// Integration contract checks for the targets resource (spec/api/weight-targets-stats-
// settings.md §Targets, M2 acceptance). Runs against the compose.test.yml Postgres.
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

type Agent = ReturnType<typeof request.agent>;

/** Seed a user, log them in, and return a cookie-primed agent + CSRF token + id. */
async function authedAgent(
  username: string,
): Promise<{ agent: Agent; csrf: string; userId: string }> {
  const passwordHash = await argon2.hash('correct-horse', { type: argon2.argon2id });
  await prisma.appUser.create({
    data: { username, passwordHash, sex: 'male', birthdate: new Date('1986-01-01'), heightCm: 180 },
  });
  const agent = request.agent(app);
  const pre = await agent.get('/api/v1/auth/session');
  const csrf = getCookie(pre, 'macronome.csrf') ?? '';
  const login = await agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', csrf)
    .send({ username, password: 'correct-horse' });
  return { agent, csrf, userId: login.body.user.id as string };
}

/** Seed a current weigh-in directly (weight CRUD is M4; M2 only reads the latest). */
function seedWeight(userId: string, weightKg: number) {
  return prisma.weightEntry.create({
    data: { userId, date: new Date('2026-06-01'), weightKg, dietFlag: 'in_diet' },
  });
}

function postTarget(agent: Agent, csrf: string, body: Record<string, unknown>) {
  return agent.post('/api/v1/target').set('x-csrf-token', csrf).send(body);
}

const inconsistentTarget = {
  calorie_min: 1000,
  calorie_max: 1200,
  protein_g_per_kg: 2.0,
  fat_g_per_kg: 1.0,
  effective_from: '2026-06-01',
};

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('targets', () => {
  it('saves an inconsistent target (carb ceiling ≤ 0) and warns without blocking', async () => {
    const { agent, csrf, userId } = await authedAgent('alice');
    await seedWeight(userId, 80);

    // Save succeeds (carb ceiling ≤ 0 never blocks) → 201.
    const created = await postTarget(agent, csrf, inconsistentTarget);
    expect(created.status).toBe(201);

    // The live readout returns the real negative value + the warning (200).
    const readout = await agent.get('/api/v1/target');
    expect(readout.status).toBe(200);
    expect(readout.body.target).not.toBeNull();
    expect(readout.body.engine.protein_floor_g).toBe(160);
    expect(readout.body.engine.fat_floor_g).toBe(80);
    expect(readout.body.engine.carb_ceiling_g).toBe(-40); // (1200 − 640 − 720)/4, not clamped
    expect(readout.body.warnings).toContain('carb_ceiling_non_positive');
  });

  it("never leaks another user's target (tenancy scoping)", async () => {
    const alice = await authedAgent('alice');
    await seedWeight(alice.userId, 80);
    await postTarget(alice.agent, alice.csrf, { ...inconsistentTarget, calorie_max: 2100 });

    // Bob, a separate user, sees none of Alice's data.
    const bob = await authedAgent('bob');
    const res = await bob.agent.get('/api/v1/target');
    expect(res.status).toBe(200);
    expect(res.body.target).toBeNull();
    expect(res.body.warnings).toContain('no_weight');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/target');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed body with 422 + per-field details', async () => {
    const { agent, csrf } = await authedAgent('alice');
    const res = await postTarget(agent, csrf, {
      calorie_min: 2000,
      calorie_max: 1500, // max < min
      protein_g_per_kg: -1, // negative
      fat_g_per_kg: 0.8,
      effective_from: '2026-06-01',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details).toHaveProperty('calorie_max');
    expect(res.body.error.details).toHaveProperty('protein_g_per_kg');
  });
});
