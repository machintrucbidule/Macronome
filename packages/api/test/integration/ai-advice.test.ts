import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, csrfPost } from './helpers.js';

// Integration contract checks for the AI advice use (B-202; spec/api/ai.md, spec/logic/ai-advice.md).
// The advice use is the only one that PERSISTS: generate archives, list reads, delete removes
// (user-scoped). The provider call is stubbed via global.fetch (restored after each test).
const app = createApp();

type Agent = Awaited<ReturnType<typeof authedAgent>>;

/** Enable the advice task with a real model (the other tasks stay null). */
function configureAdvice(a: Agent): Promise<unknown> {
  return csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
    ai: {
      provider: 'openai_compatible',
      base_url: 'https://ai.example.com/v1',
      api_key: 'k',
      tasks: {
        dish_photo_macros: { model: null, prompt: 'p' },
        meal_suggestions: { model: null, prompt: 'p' },
        advice: { model: 'coach-x', prompt: 'Give supportive advice.' },
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

const del = (a: Agent, url: string) => a.agent.delete(url).set('x-csrf-token', a.csrf);

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /ai/advice (B-202)', () => {
  it('409 ai_not_configured when the advice task has no model', async () => {
    const a = await authedAgent(app, 'alice');
    await csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
      ai: { provider: 'openai_compatible', base_url: 'https://ai.example.com/v1', api_key: 'k' },
    });
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/advice', {});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ai_not_configured');
  });

  it('201 generates and ARCHIVES the markdown reply + a snapshot', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAdvice(a);
    stubFetch('## Bilan\n\nBelle régularité — continue.');
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/advice', {});
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('## Bilan\n\nBelle régularité — continue.');
    expect(res.body.data.model).toBe('coach-x');
    expect(res.body.data.snapshot).toBeTypeOf('object');
    // Archived in the DB, user-scoped.
    const rows = await prisma.advice.findMany({ where: { userId: a.userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.content).toContain('Belle régularité');
  });

  it('accepts a content-parts array reply (Gemini/reasoning shape), not only a bare string', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAdvice(a);
    // Some OpenAI-compatible providers return message.content as [{ type:'text', text }] parts.
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: [{ type: 'text', text: '## Bilan\n\nOK' }] } }],
            }),
            { status: 200 },
          ),
        ),
      ),
    );
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/advice', {});
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('## Bilan\n\nOK');
  });

  it('502 ai_bad_response on an empty reply (nothing archived)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAdvice(a);
    stubFetch('   ');
    const res = await csrfPost(a.agent, a.csrf, '/api/v1/ai/advice', {});
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ai_bad_response');
    expect(await prisma.advice.count()).toBe(0);
  });
});

describe('GET / DELETE /ai/advice (B-202)', () => {
  it('lists newest-first and deletes per item (user-scoped)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureAdvice(a);
    stubFetch('first');
    await csrfPost(a.agent, a.csrf, '/api/v1/ai/advice', {});
    stubFetch('second');
    await csrfPost(a.agent, a.csrf, '/api/v1/ai/advice', {});

    const list = await a.agent.get('/api/v1/ai/advice');
    expect(list.status).toBe(200);
    expect(list.body.data.map((x: { content: string }) => x.content)).toEqual(['second', 'first']);

    const id = list.body.data[0].id as string;
    expect((await del(a, `/api/v1/ai/advice/${id}`)).status).toBe(204);
    expect((await a.agent.get('/api/v1/ai/advice')).body.data).toHaveLength(1);
  });

  it("404 when deleting another user's advice (no cross-tenant leak)", async () => {
    const alice = await authedAgent(app, 'alice');
    await configureAdvice(alice);
    stubFetch('alice advice');
    const created = await csrfPost(alice.agent, alice.csrf, '/api/v1/ai/advice', {});
    const id = created.body.data.id as string;

    const bob = await authedAgent(app, 'bob');
    expect((await del(bob, `/api/v1/ai/advice/${id}`)).status).toBe(404);
    // Alice's advice is untouched.
    expect(await prisma.advice.count({ where: { userId: alice.userId } })).toBe(1);
  });
});
