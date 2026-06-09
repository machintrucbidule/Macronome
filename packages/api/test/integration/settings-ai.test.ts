import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch } from './helpers.js';

// Integration contract checks for the AI connection (B-117; spec/api §Settings + GET
// /settings/ai/models, spec/logic/ai-connection.md). Storage + redaction + deep-merge of the
// `settings.ai` config, and the unconfigured-link error. The upstream model fetch is not
// exercised here (no real network call).
const app = createApp();

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('settings — AI connection (B-117)', () => {
  it('stores the AI connection, redacts the api_key, and deep-merges per task', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');

    const created = await csrfPatch(agent, csrf, '/api/v1/settings', {
      ai: {
        provider: 'openai_compatible',
        base_url: 'https://ai.example.com/v1',
        api_key: 'secret-key',
        tasks: {
          dish_photo_macros: { model: null, prompt: 'photo scope' },
          meal_suggestions: { model: null, prompt: 'meals scope' },
          advice: { model: null, prompt: 'advice scope' },
        },
      },
    });
    expect(created.status).toBe(200);
    // The secret is never echoed back; presence is exposed as api_key_set.
    expect(created.body.data.ai.api_key).toBeUndefined();
    expect(created.body.data.ai.api_key_set).toBe(true);
    expect(created.body.data.ai.base_url).toBe('https://ai.example.com/v1');
    expect(created.body.data.ai.tasks.advice.prompt).toBe('advice scope');

    // Patch a single task field without resending the key → key kept, other tasks untouched.
    const tweaked = await csrfPatch(agent, csrf, '/api/v1/settings', {
      ai: { tasks: { advice: { model: 'gemini-pro' } } },
    });
    expect(tweaked.status).toBe(200);
    expect(tweaked.body.data.ai.api_key_set).toBe(true);
    expect(tweaked.body.data.ai.tasks.advice.model).toBe('gemini-pro');
    expect(tweaked.body.data.ai.tasks.advice.prompt).toBe('advice scope');
    expect(tweaked.body.data.ai.tasks.dish_photo_macros.prompt).toBe('photo scope');

    // Clearing the key (empty string) flips api_key_set to false.
    const cleared = await csrfPatch(agent, csrf, '/api/v1/settings', { ai: { api_key: '' } });
    expect(cleared.body.data.ai.api_key_set).toBe(false);

    // A bad base_url is rejected with 422.
    const bad = await csrfPatch(agent, csrf, '/api/v1/settings', { ai: { base_url: 'not a url' } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details['ai.base_url']).toBe('invalid_url');
  });

  it('GET /settings/ai/models → 409 ai_not_configured when unconfigured', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/settings/ai/models');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ai_not_configured');
  });
});
