import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch, type Authed } from './helpers.js';

// GET /integrations/home-assistant/weight (B-180; spec/logic/integrations-connections.md
// §5/§7): server-side proxy of the HA states API with a stubbed outbound fetch —
// server-side rounding oracles + the upstream error-mapping table. The Bearer token must
// go out but never come back in any response.
const app = createApp();

const HA = {
  base_url: 'http://ha.local:8123',
  token: 'ha-secret-token',
  weight_entity_id: 'sensor.scale_weight',
  weight_round_decimals: 1,
};

async function configureHa(a: Authed, overrides: Partial<typeof HA> = {}): Promise<void> {
  await csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
    integrations: { home_assistant: { ...HA, ...overrides } },
  });
}

function stubHaState(state: string, unit = 'kg'): ReturnType<typeof vi.fn> {
  const fn = vi.fn(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          state,
          last_changed: '2026-07-04T06:12:00+00:00',
          attributes: { unit_of_measurement: unit },
        }),
        { status: 200 },
      ),
    ),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
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

describe('GET /integrations/home-assistant/weight (B-180)', () => {
  it('§5.1 returns the measurement rounded to the configured decimals (default 1)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureHa(a);
    const fetchSpy = stubHaState('83.3521');

    const res = await a.agent.get('/api/v1/integrations/home-assistant/weight');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      weight_kg: 83.4,
      measured_at: '2026-07-04T06:12:00+00:00',
      unit: 'kg',
      entity_id: 'sensor.scale_weight',
    });
    // Outbound call carries the stored token; the response never does.
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://ha.local:8123/api/states/sensor.scale_weight');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ha-secret-token');
    expect(JSON.stringify(res.body)).not.toContain('ha-secret-token');
  });

  it('§5.2 rounds to 2 decimals when configured', async () => {
    const a = await authedAgent(app, 'alice');
    await configureHa(a, { weight_round_decimals: 2 });
    stubHaState('83.3521');
    const res = await a.agent.get('/api/v1/integrations/home-assistant/weight');
    expect(res.body.data.weight_kg).toBe(83.35);
  });

  it('§5.4 "unavailable" state → 409 ha_no_measurement', async () => {
    const a = await authedAgent(app, 'alice');
    await configureHa(a);
    stubHaState('unavailable');
    const res = await a.agent.get('/api/v1/integrations/home-assistant/weight');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ha_no_measurement');
  });

  it('§5.5 non-kg unit → 502 ha_bad_response', async () => {
    const a = await authedAgent(app, 'alice');
    await configureHa(a);
    stubHaState('183.5', 'lb');
    const res = await a.agent.get('/api/v1/integrations/home-assistant/weight');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ha_bad_response');
  });

  it('upstream 401 → 502 ha_unauthorized (no retry)', async () => {
    const a = await authedAgent(app, 'alice');
    await configureHa(a);
    const fn = vi.fn(() => Promise.resolve(new Response('', { status: 401 })));
    vi.stubGlobal('fetch', fn);
    const res = await a.agent.get('/api/v1/integrations/home-assistant/weight');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ha_unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('upstream 404 → 502 ha_entity_not_found', async () => {
    const a = await authedAgent(app, 'alice');
    await configureHa(a);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('', { status: 404 }))),
    );
    const res = await a.agent.get('/api/v1/integrations/home-assistant/weight');
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ha_entity_not_found');
  });

  it('unconfigured → 409 ha_not_configured (no outbound call)', async () => {
    const a = await authedAgent(app, 'alice');
    const fn = vi.fn();
    vi.stubGlobal('fetch', fn);
    const res = await a.agent.get('/api/v1/integrations/home-assistant/weight');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ha_not_configured');
    expect(fn).not.toHaveBeenCalled();
  });
});
