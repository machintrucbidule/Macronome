import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost } from './helpers.js';

// Integration contract checks for the AI dish-photo use (B-118; spec/api/ai.md,
// spec/logic/ai-dish-photo-macros.md). Validation + the not-configured paths run without any
// network; the provider call is exercised with a stubbed global.fetch (restored after each test).
const app = createApp();
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';

async function configureAi(agent: Awaited<ReturnType<typeof authedAgent>>): Promise<void> {
  await csrfPatch(agent.agent, agent.csrf, '/api/v1/settings', {
    ai: {
      provider: 'openai_compatible',
      base_url: 'https://ai.example.com/v1',
      api_key: 'k',
      tasks: {
        dish_photo_macros: { model: 'vision-x', prompt: 'Estimate macros.' },
        meal_suggestions: { model: null, prompt: 'p' },
        advice: { model: null, prompt: 'p' },
      },
    },
  });
}

function stubFetch(content: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
      ),
    ),
  );
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /ai/dish-photo-macros (B-118)', () => {
  it('422 on invalid body (nothing / too many / bad MIME / long note)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    // Neither image nor note → rejected (at-least-one rule).
    expect(
      (await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', { images: [] })).status,
    ).toBe(422);
    expect((await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', {})).status).toBe(422);
    expect(
      (
        await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', {
          images: Array(5).fill(IMG),
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', {
          images: ['data:application/pdf;base64,AA'],
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', {
          images: [IMG],
          note: 'x'.repeat(501),
        })
      ).status,
    ).toBe(422);
  });

  it('409 ai_not_configured when the link is unset', async () => {
    const a = await authedAgent(app, 'alice');
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', { images: [IMG] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ai_not_configured');
  });

  it('409 ai_not_configured when configured but the task model is null', async () => {
    const a = await authedAgent(app, 'alice');
    await csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
      ai: { provider: 'openai_compatible', base_url: 'https://ai.example.com/v1', api_key: 'k' },
    });
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', { images: [IMG] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ai_not_configured');
  });
});

describe('POST /ai/dish-photo-macros — provider outcomes (B-118)', () => {
  it('200 maps a clean provider response to the estimate', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    stubFetch(
      '{"dish_name":"Pasta","calories_kcal":620,"weight_g":350,"fat_g":18,"carb_g":80,"protein_g":24}',
    );
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', {
      images: [IMG],
      note: 'big plate',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      dish_name: 'Pasta',
      kcal: 620,
      weight_g: 350,
      fat_g: 18,
      carb_g: 80,
      protein_g: 24,
    });
  });

  it('200 with a note only (no image)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    stubFetch(
      '{"dish_name":"Saucisson + bread","calories_kcal":300,"weight_g":90,"fat_g":20,"carb_g":15,"protein_g":12}',
    );
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', {
      note: '3 slices of saucisson, 2 slices of bread',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.dish_name).toBe('Saucisson + bread');
  });

  it('502 ai_bad_response when the provider body is unparseable', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    stubFetch('I cannot estimate this dish.');
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', { images: [IMG] });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ai_bad_response');
  });

  it('429 → ai_rate_limited and surfaces the provider message', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAi(a);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([{ error: { message: 'You exceeded your current quota' } }]),
            { status: 429 },
          ),
        ),
      ),
    );
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/dish-photo-macros', { images: [IMG] });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('ai_rate_limited');
    expect(res.body.error.details.provider_message).toContain('quota');
  });
});
