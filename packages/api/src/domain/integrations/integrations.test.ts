import { expect, test } from 'vitest';
import {
  HomeAssistantConnectionSchema,
  type BarclaudeGatewayConnection,
  type HomeAssistantConnection,
} from '@macronome/shared';
import { mergeIntegrations, type StoredIntegrations } from './merge.js';
import { redactIntegrations } from './redact.js';

// Neutral oracles from spec/logic/integrations-connections.md §2/§3/§4 (no personal data).

const ha: HomeAssistantConnection = {
  base_url: 'http://ha.local:8123',
  token: 't',
  weight_entity_id: 'sensor.scale_weight',
  weight_round_decimals: 1,
};
const bg: BarclaudeGatewayConnection = { base_url: 'http://gw.local:8080', api_key: 'k' };
const stored: StoredIntegrations = { home_assistant: ha, barclaude_gateway: bg };

test('§2 entity id format is enforced (invalid_entity_id)', () => {
  const res = HomeAssistantConnectionSchema.safeParse({ ...ha, weight_entity_id: 'Not An Id' });
  expect(res.success).toBe(false);
  if (!res.success) {
    const issue = res.error.issues.find((i) => i.path.join('.') === 'weight_entity_id');
    expect(issue?.message).toBe('invalid_entity_id');
  }
});

test('§2 round decimals bounded 0..3 (invalid_round_decimals)', () => {
  const res = HomeAssistantConnectionSchema.safeParse({ ...ha, weight_round_decimals: 4 });
  expect(res.success).toBe(false);
  if (!res.success) {
    expect(res.error.issues[0]?.message).toBe('invalid_round_decimals');
  }
});

test('§3 absent connection key leaves the stored connection untouched', () => {
  const merged = mergeIntegrations(stored, { barclaude_gateway: { base_url: 'http://gw2:1' } });
  expect(merged.home_assistant).toEqual(ha);
  expect(merged.barclaude_gateway?.base_url).toBe('http://gw2:1');
  expect(merged.barclaude_gateway?.api_key).toBe('k'); // secret kept
});

test('§3 null disconnects one connection without touching the other', () => {
  const merged = mergeIntegrations(stored, { home_assistant: null });
  expect(merged.home_assistant).toBeNull();
  expect(merged.barclaude_gateway).toEqual(bg);
});

test('§3 secret absent = keep, "" or null = clear, value = replace', () => {
  expect(
    mergeIntegrations(stored, { home_assistant: { base_url: 'http://x' } }).home_assistant,
  ).toMatchObject({ base_url: 'http://x', token: 't' });
  expect(
    mergeIntegrations(stored, { home_assistant: { token: '' } }).home_assistant?.token,
  ).toBeUndefined();
  expect(
    mergeIntegrations(stored, { barclaude_gateway: { api_key: null } }).barclaude_gateway?.api_key,
  ).toBeUndefined();
  expect(mergeIntegrations(stored, { home_assistant: { token: 't2' } }).home_assistant?.token).toBe(
    't2',
  );
});

test('§3 patching a null connection creates it; decimals default to 1', () => {
  const empty: StoredIntegrations = { home_assistant: null, barclaude_gateway: null };
  const merged = mergeIntegrations(empty, {
    home_assistant: {
      base_url: 'http://ha.local:8123',
      token: 't',
      weight_entity_id: 'sensor.scale_weight',
    },
  });
  expect(merged.home_assistant).toEqual({
    base_url: 'http://ha.local:8123',
    token: 't',
    weight_entity_id: 'sensor.scale_weight',
    weight_round_decimals: 1,
  });
  expect(merged.barclaude_gateway).toBeNull();
});

test('§4 redaction strips secrets and exposes *_set booleans', () => {
  const read = redactIntegrations(stored);
  expect(read.home_assistant).toEqual({
    base_url: 'http://ha.local:8123',
    token_set: true,
    weight_entity_id: 'sensor.scale_weight',
    weight_round_decimals: 1,
  });
  expect(read.barclaude_gateway).toEqual({ base_url: 'http://gw.local:8080', api_key_set: true });
  expect(read.home_assistant).not.toHaveProperty('token');
  expect(read.barclaude_gateway).not.toHaveProperty('api_key');
});

test('§4 null connections pass through; empty secret → *_set false', () => {
  const read = redactIntegrations({
    home_assistant: { ...ha, token: undefined },
    barclaude_gateway: null,
  });
  expect(read.home_assistant?.token_set).toBe(false);
  expect(read.barclaude_gateway).toBeNull();
});
