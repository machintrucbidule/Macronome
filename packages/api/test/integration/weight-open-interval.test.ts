import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost } from './helpers.js';

// Integration checks for the Poids open interval (last weigh-in → today, B-176;
// spec/logic/weight-periods-trajectory.md §2.1). GET /weight emits open_period only when
// triggered; its note + régime are the persisted open_period_note + current_mode (the reduced
// open modal writes both in one PATCH /settings); clearing the note drops it from the next read.
const app = createApp();

/** ISO date n days before today (UTC) — the service's `today` is also UTC. */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function postWeighIn(agent: Parameters<typeof csrfPost>[0], csrf: string, date: string) {
  return csrfPost(agent, csrf, '/api/v1/weight', { date, weight_kg: 80, diet_flag: 'in_diet' });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('weight open interval (B-176)', () => {
  it('emits open_period when the last weigh-in is ≥1 day old with a logged day since', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await postWeighIn(agent, csrf, isoDaysAgo(3));
    await csrfPatch(agent, csrf, `/api/v1/days/${isoDaysAgo(1)}`, { summary_kcal: 2000 });

    const res = await agent.get('/api/v1/weight');
    expect(res.status).toBe(200);
    expect(res.body.open_period).not.toBeNull();
    expect(res.body.open_period).toMatchObject({
      open: true,
      start_date: isoDaysAgo(3),
      days: 3,
      avg_intake: 2000,
      weight_end: null,
      ema: null,
      delta: null,
      diet_flag: 'in_diet', // = current_mode (defaults to the latest flag)
    });
    expect(typeof res.body.open_period.estimated_burn).toBe('number');
    expect(typeof res.body.open_period.deficit_per_day).toBe('number');
  });

  it('omits open_period when not triggered (weighed today, or no logged day in the span)', async () => {
    const today = await authedAgent(app, 'bob');
    await postWeighIn(today.agent, today.csrf, isoDaysAgo(0)); // span 0 → no open interval
    expect((await today.agent.get('/api/v1/weight')).body.open_period).toBeNull();

    const noLog = await authedAgent(app, 'carol');
    await postWeighIn(noLog.agent, noLog.csrf, isoDaysAgo(3)); // old, but nothing logged since
    expect((await noLog.agent.get('/api/v1/weight')).body.open_period).toBeNull();
  });

  it('persists the open-period note + régime (PATCH /settings) and clears it on demand', async () => {
    const { agent, csrf } = await authedAgent(app, 'dave');
    await postWeighIn(agent, csrf, isoDaysAgo(3));
    await csrfPatch(agent, csrf, `/api/v1/days/${isoDaysAgo(1)}`, { summary_kcal: 2000 });

    // The reduced open modal does ONE settings PATCH (régime + note).
    await csrfPatch(agent, csrf, '/api/v1/settings', {
      current_mode: 'not_in_diet',
      open_period_note: 'feeling good',
    });

    const withNote = await agent.get('/api/v1/weight');
    expect(withNote.body.open_period.note).toBe('feeling good');
    expect(withNote.body.open_period.diet_flag).toBe('not_in_diet'); // régime = current_mode
    expect(withNote.body.current_mode).toBe('not_in_diet');

    // Clearing it (the closing-weigh-in flow) drops the note from the next read.
    await csrfPatch(agent, csrf, '/api/v1/settings', { open_period_note: null });
    expect((await agent.get('/api/v1/weight')).body.open_period.note).toBeNull();
  });
});
