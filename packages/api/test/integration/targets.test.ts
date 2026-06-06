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

/** UTC-midnight date N days before today (recent-average activity window is relative to
 * today, so seed dates are computed from the runtime clock — not a fixed calendar date). */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Seed a logged day with an activity level (recent-average activity input, B-072). */
function seedDay(userId: string, date: Date, activityLevel: string) {
  return prisma.dayLog.create({
    data: {
      userId,
      date,
      kind: 'summary',
      summaryKcal: 2000,
      activityLevel,
      targetSnapshot: { cal_min: 1500, cal_max: 2100 },
    },
  });
}

function postTarget(agent: Agent, csrf: string, body: Record<string, unknown>) {
  return agent.post('/api/v1/target').set('x-csrf-token', csrf).send(body);
}

function postPreview(agent: Agent, csrf: string, body: Record<string, unknown>) {
  return agent.post('/api/v1/target/preview').set('x-csrf-token', csrf).send(body);
}

const draftTarget = {
  calorie_min: 1500,
  calorie_max: 2100,
  protein_g_per_kg: 1.8,
  fat_g_per_kg: 0.8,
  target_weight_kg: 72,
};

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

  describe('POST /target/preview — stateless live recompute (B-042)', () => {
    it('returns the engine readout for a draft (incl. target BMI) without persisting', async () => {
      const { agent, csrf, userId } = await authedAgent('alice');
      await seedWeight(userId, 80);

      const res = await postPreview(agent, csrf, draftTarget);
      expect(res.status).toBe(200);
      // Derived from current weight 80 kg / height 180 cm (targets-macros.md §3).
      expect(res.body.engine.protein_floor_g).toBe(144); // 1.8 × 80
      expect(res.body.engine.fat_floor_g).toBe(64); // 0.8 × 80
      expect(res.body.engine.carb_ceiling_g).toBe(237); // (2100 − 576 − 576)/4
      // Target BMI = target_weight 72 / (1.80)² (targets-macros.md §6).
      expect(res.body.engine.target_bmi).toBeCloseTo(22.222, 2);
      expect(res.body).not.toHaveProperty('target'); // preview never echoes a row
      // Nothing was written.
      expect(await prisma.target.count({ where: { userId } })).toBe(0);
    });

    it('computes target BMI even with no weigh-in (BMI uses the goal weight, not the current)', async () => {
      const { agent, csrf } = await authedAgent('alice');
      const res = await postPreview(agent, csrf, draftTarget);
      expect(res.status).toBe(200);
      // Weight-dependent figures are null + the no-weight warning…
      expect(res.body.engine.protein_floor_g).toBeNull();
      expect(res.body.warnings).toContain('no_weight');
      // …but target BMI is independent of any weigh-in.
      expect(res.body.engine.target_bmi).toBeCloseTo(22.222, 2);
    });

    it('returns target_bmi null when no target weight is given', async () => {
      const { agent, csrf, userId } = await authedAgent('alice');
      await seedWeight(userId, 80);
      const { target_weight_kg, ...noGoal } = draftTarget;
      void target_weight_kg;
      const res = await postPreview(agent, csrf, noGoal);
      expect(res.status).toBe(200);
      expect(res.body.engine.target_bmi).toBeNull();
    });

    it('rejects a malformed draft with 422 (max < min)', async () => {
      const { agent, csrf } = await authedAgent('alice');
      const res = await postPreview(agent, csrf, { ...draftTarget, calorie_min: 2200 });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('validation_error');
    });
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

describe('recent-average activity — Cibles burn from logged days (B-072)', () => {
  it('uses the mean of logged-day multipliers in the 30-day window, no insufficient-data flag', async () => {
    const { agent, userId } = await authedAgent('alice');
    await seedWeight(userId, 80);
    // Two recent very_active days (multiplier 1.725) within the trailing 30-day window.
    await seedDay(userId, daysAgo(0), 'very_active');
    await seedDay(userId, daysAgo(1), 'very_active');

    const res = await agent.get('/api/v1/target');
    expect(res.status).toBe(200);
    expect(res.body.engine.recent_avg_activity).toBeCloseTo(1.725, 6);
    // estimated_burn = BMR × multiplier (BMR depends on age → assert the relationship).
    expect(res.body.engine.estimated_burn).toBeCloseTo(res.body.engine.bmr * 1.725, 5);
    expect(res.body.warnings).not.toContain('insufficient_activity_data');
  });

  it('averages across activity levels in the window', async () => {
    const { agent, userId } = await authedAgent('alice');
    await seedWeight(userId, 80);
    await seedDay(userId, daysAgo(0), 'very_active'); // 1.725
    await seedDay(userId, daysAgo(1), 'sedentary'); // 1.2

    const res = await agent.get('/api/v1/target');
    expect(res.status).toBe(200);
    expect(res.body.engine.recent_avg_activity).toBeCloseTo(1.4625, 6); // (1.725 + 1.2) / 2
    expect(res.body.warnings).not.toContain('insufficient_activity_data');
  });

  it('falls back to sedentary + flags insufficient data when no day is logged', async () => {
    const { agent, userId } = await authedAgent('alice');
    await seedWeight(userId, 80);

    const res = await agent.get('/api/v1/target');
    expect(res.status).toBe(200);
    expect(res.body.engine.recent_avg_activity).toBeCloseTo(1.2, 6);
    expect(res.body.warnings).toContain('insufficient_activity_data');
  });

  it('ignores logged days outside the 30-day window (calendar semantics)', async () => {
    const { agent, userId } = await authedAgent('alice');
    await seedWeight(userId, 80);
    // A very_active day older than the 30-day window must not count.
    await seedDay(userId, daysAgo(40), 'very_active');

    const res = await agent.get('/api/v1/target');
    expect(res.status).toBe(200);
    expect(res.body.engine.recent_avg_activity).toBeCloseTo(1.2, 6);
    expect(res.body.warnings).toContain('insufficient_activity_data');
  });
});
