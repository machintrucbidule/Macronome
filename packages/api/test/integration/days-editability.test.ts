import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, seedTarget, seedWeight } from './helpers.js';

// Day field editability (ED-1 / B-096): activity is editable on summary / imported days
// (the former 409 summary_day_readonly is lifted), while the detailed-day total stays the
// read-only derived Σ (409 calories_not_editable kept — covered in days.test.ts). Direct
// edits never recompute a past day's frozen snapshot. Runs against compose.test.yml.
const app = createApp();
const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('daily log — field editability (ED-1 / B-096)', () => {
  it('edits activity on a summary (imported) day instead of 409 summary_day_readonly', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, { summary_kcal: 1950 }); // → summary day

    const patched = await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
      activity_level: 'moderately_active',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.kind).toBe('summary'); // still a summary day
    expect(patched.body.activity_level).toBe('moderately_active');
    expect(patched.body.summary_kcal).toBe(1950); // total untouched
  });

  it('applies summary_kcal and activity_level together on a summary day', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await seedTarget(userId, '2026-01-01');
    await seedWeight(userId, '2026-01-01', 80);
    await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, { summary_kcal: 1950 });

    const patched = await csrfPatch(agent, csrf, `/api/v1/days/${TODAY}`, {
      summary_kcal: 2200,
      activity_level: 'very_active',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.kind).toBe('summary');
    expect(patched.body.summary_kcal).toBe(2200);
    expect(patched.body.activity_level).toBe('very_active');
  });

  it('editing activity on a past summary day keeps its frozen target_snapshot', async () => {
    const PAST = '2026-01-05';
    const { agent, csrf, userId } = await authedAgent(app, 'alice');
    await prisma.dayLog.create({
      data: {
        userId,
        date: new Date(`${PAST}T00:00:00.000Z`),
        kind: 'summary',
        summaryKcal: 1800,
        activityLevel: 'sedentary',
        targetSnapshot: {
          cal_min: 1900,
          cal_max: 2100,
          protein_floor_g: null,
          fat_floor_g: null,
          carb_ceiling_g: null,
        },
      },
    });
    // A later target exists; a live resolve would differ — the frozen past snapshot must win.
    await seedTarget(userId, '2026-02-01', 1500, 1700);

    const patched = await csrfPatch(agent, csrf, `/api/v1/days/${PAST}`, {
      activity_level: 'moderately_active',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.activity_level).toBe('moderately_active');
    expect(patched.body.target_snapshot).toMatchObject({ cal_min: 1900, cal_max: 2100 });
  });
});
