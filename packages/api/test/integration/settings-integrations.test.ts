import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPatch } from './helpers.js';

// Integration contract checks for settings.integrations (B-180/B-181;
// spec/logic/integrations-connections.md §2–§4, spec/api/integrations.md §Settings
// transport): storage, redaction (secrets never in any response), per-connection patch
// isolation (incl. vs `ai`), secret clearing, local validation. No outbound call here.
const app = createApp();

const HA = {
  base_url: 'http://ha.local:8123',
  token: 'ha-secret-token',
  weight_entity_id: 'sensor.scale_weight',
  weight_round_decimals: 1,
};
const GW = { base_url: 'http://gw.local:8080', api_key: 'gw-secret-key' };

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('settings — integrations connections (B-180/B-181)', () => {
  it('stores both connections and redacts them to *_set booleans', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const created = await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { home_assistant: HA, barclaude_gateway: GW },
    });
    expect(created.status).toBe(200);
    const integrations = created.body.data.integrations;
    expect(integrations.home_assistant).toEqual({
      base_url: 'http://ha.local:8123',
      token_set: true,
      weight_entity_id: 'sensor.scale_weight',
      weight_round_decimals: 1,
    });
    expect(integrations.barclaude_gateway).toEqual({
      base_url: 'http://gw.local:8080',
      api_key_set: true,
    });
  });

  it('never carries a secret in any response (PATCH echo + GET)', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    const created = await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { home_assistant: HA, barclaude_gateway: GW },
    });
    expect(JSON.stringify(created.body)).not.toContain('ha-secret-token');
    expect(JSON.stringify(created.body)).not.toContain('gw-secret-key');
    const read = await agent.get('/api/v1/settings');
    expect(JSON.stringify(read.body)).not.toContain('ha-secret-token');
    expect(JSON.stringify(read.body)).not.toContain('gw-secret-key');
  });
});

describe('settings — integrations merge & validation (B-180/B-181)', () => {
  it('patches one connection without clobbering the other or the ai config', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await csrfPatch(agent, csrf, '/api/v1/settings', {
      ai: {
        provider: 'openai_compatible',
        base_url: 'https://ai.example.com/v1',
        api_key: 'ai-key',
      },
      integrations: { home_assistant: HA, barclaude_gateway: GW },
    });

    const res = await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { barclaude_gateway: { base_url: 'http://gw2.local:9090' } },
    });
    expect(res.status).toBe(200);
    // Gateway URL replaced, its key kept; HA and ai untouched.
    expect(res.body.data.integrations.barclaude_gateway).toEqual({
      base_url: 'http://gw2.local:9090',
      api_key_set: true,
    });
    expect(res.body.data.integrations.home_assistant.token_set).toBe(true);
    expect(res.body.data.integrations.home_assistant.weight_entity_id).toBe('sensor.scale_weight');
    expect(res.body.data.ai.api_key_set).toBe(true);
  });

  it("clears a secret on '' and disconnects a connection on null", async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');
    await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { home_assistant: HA, barclaude_gateway: GW },
    });

    const cleared = await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { home_assistant: { token: '' } },
    });
    expect(cleared.body.data.integrations.home_assistant.token_set).toBe(false);
    expect(cleared.body.data.integrations.home_assistant.base_url).toBe('http://ha.local:8123');

    const disconnected = await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { home_assistant: null },
    });
    expect(disconnected.body.data.integrations.home_assistant).toBeNull();
    expect(disconnected.body.data.integrations.barclaude_gateway.api_key_set).toBe(true);
  });

  it('rejects a malformed base_url / entity id / decimals with 422 field details', async () => {
    const { agent, csrf } = await authedAgent(app, 'alice');

    const badUrl = await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { home_assistant: { base_url: 'not a url' } },
    });
    expect(badUrl.status).toBe(422);
    expect(badUrl.body.error.details['integrations.home_assistant.base_url']).toBe('invalid_url');

    const badEntity = await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { home_assistant: { weight_entity_id: 'Not An Id' } },
    });
    expect(badEntity.status).toBe(422);
    expect(badEntity.body.error.details['integrations.home_assistant.weight_entity_id']).toBe(
      'invalid_entity_id',
    );

    const badDecimals = await csrfPatch(agent, csrf, '/api/v1/settings', {
      integrations: { home_assistant: { weight_round_decimals: 7 } },
    });
    expect(badDecimals.status).toBe(422);
  });
});
