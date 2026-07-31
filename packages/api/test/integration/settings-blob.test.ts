import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch } from './helpers.js';

// The app_user.settings blob itself (spec/api §Settings): defaults on read, partial PATCH merge,
// and the bounded numeric fields — the line floors (B-203) and the minimum meal columns (B-244).
// Split out of settings-pantry.test.ts when that file hit the 300-line ceiling; the template,
// pantry and container suites stayed there.
const app = createApp();

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('settings — round-trip + partial merge', () => {
  it('returns defaults, persists a partial patch, and preserves untouched keys', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');

    const initial = await agent.get('/api/v1/settings');
    expect(initial.status).toBe(200);
    expect(initial.body.data).toEqual({
      locale: 'fr',
      theme: 'dark',
      ai: null,
      integrations: { home_assistant: null, barclaude_gateway: null, google_drive: null },
      current_mode: null,
      open_period_note: null,
      lines_desktop: 20,
      lines_mobile: 15,
      min_meal_columns: 4,
    });

    const patched = await csrfPatch(agent, csrf, '/api/v1/settings', {
      theme: 'light',
      current_mode: 'not_in_diet',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.theme).toBe('light');
    expect(patched.body.data.current_mode).toBe('not_in_diet');

    // A second, unrelated patch must not clobber the previously stored keys.
    const localeOnly = await csrfPatch(agent, csrf, '/api/v1/settings', { locale: 'en' });
    expect(localeOnly.body.data.locale).toBe('en');
    expect(localeOnly.body.data.theme).toBe('light');
    expect(localeOnly.body.data.current_mode).toBe('not_in_diet');
  });

  it('persists the configurable line floors and rejects out-of-bounds values (B-203)', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');

    const patched = await csrfPatch(agent, csrf, '/api/v1/settings', {
      lines_desktop: 24,
      lines_mobile: 12,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.lines_desktop).toBe(24);
    expect(patched.body.data.lines_mobile).toBe(12);

    // Re-GET proves persistence + partial-merge preservation of the two keys.
    const reread = await agent.get('/api/v1/settings');
    expect(reread.body.data.lines_desktop).toBe(24);
    expect(reread.body.data.lines_mobile).toBe(12);

    // Out of the [5, 50] range → 422 (Zod validation), stored value untouched.
    const tooHigh = await csrfPatch(agent, csrf, '/api/v1/settings', { lines_desktop: 500 });
    expect(tooHigh.status).toBe(422);
    const tooLow = await csrfPatch(agent, csrf, '/api/v1/settings', { lines_mobile: 1 });
    expect(tooLow.status).toBe(422);
    expect((await agent.get('/api/v1/settings')).body.data.lines_desktop).toBe(24);
  });

  it('persists the minimum meal-column count and rejects out-of-bounds values (B-244)', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');

    const patched = await csrfPatch(agent, csrf, '/api/v1/settings', { min_meal_columns: 5 });
    expect(patched.status).toBe(200);
    expect(patched.body.data.min_meal_columns).toBe(5);
    expect((await agent.get('/api/v1/settings')).body.data.min_meal_columns).toBe(5);

    // Out of the [1, 6] range → 422 (Zod validation), stored value untouched.
    expect((await csrfPatch(agent, csrf, '/api/v1/settings', { min_meal_columns: 7 })).status).toBe(
      422,
    );
    expect((await csrfPatch(agent, csrf, '/api/v1/settings', { min_meal_columns: 0 })).status).toBe(
      422,
    );
    expect((await agent.get('/api/v1/settings')).body.data.min_meal_columns).toBe(5);
  });

  it('persists current_mode so the Weight view reports it (Maintien gate)', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await csrfPatch(agent, csrf, '/api/v1/settings', { current_mode: 'not_in_diet' });
    const weight = await agent.get('/api/v1/weight');
    expect(weight.body.current_mode).toBe('not_in_diet');
  });
});
