import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, type Authed } from './helpers.js';

// GET /integrations/barclaude-gateway/ping (B-181; spec/logic/integrations-connections.md
// §6/§7): the gateway card's connection proof, with a stubbed outbound fetch. The X-API-Key
// header must go out but never come back.
const app = createApp();

async function configureGateway(a: Authed): Promise<void> {
  await csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
    integrations: { barclaude_gateway: { base_url: 'http://gw.local:8080', api_key: 'gw-key' } },
  });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /integrations/barclaude-gateway/ping (B-181)', () => {
  it('proxies the ping with the stored key and passes the payload through', async () => {
    const a = await authedAgent(app, 'alice');
    await configureGateway(a);
    const fn = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ status: 'ok', version: 1 }), { status: 200 })),
    );
    vi.stubGlobal('fetch', fn);

    const res = await a.agent.get('/api/v1/integrations/barclaude-gateway/ping');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', version: 1 });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://gw.local:8080/api/v1/ping');
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('gw-key');
    expect(JSON.stringify(res.body)).not.toContain('gw-key');
  });

  it('upstream 401 → 502 gateway_unauthorized (no retry)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureGateway(a);
    const fn = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'bad key', code: 'unauthorized' }), { status: 401 }),
      ),
    );
    vi.stubGlobal('fetch', fn);
    const res = await a.agent.get('/api/v1/integrations/barclaude-gateway/ping');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('gateway_unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('unconfigured → 409 gateway_not_configured (no outbound call)', async () => {
    const a = await authedAgent(app, 'alice');
    const fn = vi.fn();
    vi.stubGlobal('fetch', fn);
    const res = await a.agent.get('/api/v1/integrations/barclaude-gateway/ping');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('gateway_not_configured');
    expect(fn).not.toHaveBeenCalled();
  });
});

// §8.3.1 oracle product (neutral, spec/logic/integrations-connections.md).
const PANZANI = {
  id: 'p1',
  name: 'Spaghetti',
  brand: 'Panzani',
  unitQuantityLabel: '500 g',
  image: 'http://gw.local:8080/img/p1.jpg',
  price: { default: 1.15 },
  nutrition: { base: '100 g', energyKcal: 361, fat: 1.4, carbohydrate: 72, protein: 12 },
};

function stubJson(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const fn = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('GET /integrations/barclaude-gateway/search (B-182)', () => {
  it('proxies with the key + size=10 and shapes compact snake_case rows', async () => {
    const a = await authedAgent(app, 'alice');
    await configureGateway(a);
    const fn = stubJson({ products: [PANZANI, { id: 'p2', name: 'X' }] });

    const res = await a.agent.get('/api/v1/integrations/barclaude-gateway/search?q=spaghetti');
    expect(res.status).toBe(200);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://gw.local:8080/api/v1/search?q=spaghetti&size=10');
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('gw-key');
    expect(res.body.data).toEqual([
      {
        id: 'p1',
        name: 'Spaghetti',
        brand: 'Panzani',
        image_url: 'http://gw.local:8080/img/p1.jpg',
        unit_quantity_label: '500 g',
        price_eur: 1.15,
      },
      {
        id: 'p2',
        name: 'X',
        brand: null,
        image_url: null,
        unit_quantity_label: null,
        price_eur: null,
      },
    ]);
  });

  it('q shorter than 3 chars → 422, no outbound call', async () => {
    const a = await authedAgent(app, 'alice');
    await configureGateway(a);
    const fn = vi.fn();
    vi.stubGlobal('fetch', fn);
    const res = await a.agent.get('/api/v1/integrations/barclaude-gateway/search?q=ab');
    expect(res.status).toBe(422);
    expect(res.body.error.details.q).toBe('too_short');
    expect(fn).not.toHaveBeenCalled();
  });

  it('unconfigured → 409 · bad key → 502 gateway_unauthorized', async () => {
    const a = await authedAgent(app, 'alice');
    const unconfigured = await a.agent.get('/api/v1/integrations/barclaude-gateway/search?q=abc');
    expect(unconfigured.status).toBe(409);
    expect(unconfigured.body.error.code).toBe('gateway_not_configured');

    await configureGateway(a);
    stubJson({ error: 'bad key', code: 'unauthorized' }, 401);
    const res = await a.agent.get('/api/v1/integrations/barclaude-gateway/search?q=abc');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('gateway_unauthorized');
  });
});

describe('GET /integrations/barclaude-gateway/products/:id (B-182)', () => {
  it('returns the summary + the §8.3.1 server-side food_prefill', async () => {
    const a = await authedAgent(app, 'alice');
    await configureGateway(a);
    stubJson(PANZANI);

    const res = await a.agent.get('/api/v1/integrations/barclaude-gateway/products/p1');
    expect(res.status).toBe(200);
    expect(res.body.data.food_prefill).toEqual({
      name: 'Panzani Spaghetti',
      kcal_per_100g: 361,
      fat_per_100g: 1.4,
      carb_per_100g: 72,
      protein_per_100g: 12,
      comment: '500 g',
    });
    expect(res.body.data.id).toBe('p1');
    expect(res.body.data.unit_quantity_label).toBe('500 g');
  });

  it('upstream 404/not_found → 404 gateway_not_found (no retry)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureGateway(a);
    const fn = stubJson({ error: 'unknown product', code: 'not_found' }, 404);
    const res = await a.agent.get('/api/v1/integrations/barclaude-gateway/products/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('gateway_not_found');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
