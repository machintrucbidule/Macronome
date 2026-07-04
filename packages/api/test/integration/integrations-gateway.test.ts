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
