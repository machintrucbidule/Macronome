import { expect, test } from 'vitest';
import {
  GoogleDrivePatchSchema,
  HomeAssistantConnectionSchema,
  type BarclaudeGatewayConnection,
  type GoogleDriveConnection,
  type HomeAssistantConnection,
} from '@macronome/shared';
import { mergeIntegrations, type StoredIntegrations } from './merge.js';
import { redactIntegrations } from './redact.js';

// Neutral oracles from spec/logic/integrations-connections.md §2/§3/§4/§9.6 (no personal data).

const ha: HomeAssistantConnection = {
  base_url: 'http://ha.local:8123',
  token: 't',
  weight_entity_id: 'sensor.scale_weight',
  weight_round_decimals: 1,
};
const bg: BarclaudeGatewayConnection = { base_url: 'http://gw.local:8080', api_key: 'k' };
const stored: StoredIntegrations = {
  home_assistant: ha,
  barclaude_gateway: bg,
  google_drive: null,
};

const gd: GoogleDriveConnection = {
  client_id: 'cid',
  client_secret: 'csecret',
  refresh_token: 'rtok',
  folder_id: 'F1',
  enabled: true,
  retention_days: 7,
  time_of_day: '03:00',
  last_backup_at: '2026-01-15T02:00:00Z',
  last_status: 'ok',
  last_error: null,
};
const storedGd: StoredIntegrations = {
  home_assistant: null,
  barclaude_gateway: null,
  google_drive: gd,
};

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
  const empty: StoredIntegrations = {
    home_assistant: null,
    barclaude_gateway: null,
    google_drive: null,
  };
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
    google_drive: null,
  });
  expect(read.home_assistant?.token_set).toBe(false);
  expect(read.barclaude_gateway).toBeNull();
  expect(read.google_drive).toBeNull();
});

// --- Google Drive backup (spec/logic/integrations-connections.md §9.6) ------

test('§9.6 redaction hides both google_drive secrets and passes the rest', () => {
  const read = redactIntegrations(storedGd).google_drive;
  expect(read).toEqual({
    client_id: 'cid',
    client_secret_set: true,
    refresh_token_set: true,
    folder_id: 'F1',
    enabled: true,
    retention_days: 7,
    time_of_day: '03:00',
    last_backup_at: '2026-01-15T02:00:00Z',
    last_status: 'ok',
    last_error: null,
  });
  expect(read).not.toHaveProperty('client_secret');
  expect(read).not.toHaveProperty('refresh_token');
});

test('§9.6 empty secrets → *_set false (the "not connected" signal)', () => {
  const read = redactIntegrations({
    home_assistant: null,
    barclaude_gateway: null,
    google_drive: { ...gd, client_secret: '', refresh_token: '' },
  }).google_drive;
  expect(read?.client_secret_set).toBe(false);
  expect(read?.refresh_token_set).toBe(false);
});

test('§9.6 merge keeps client_secret when absent and patches only patchable fields', () => {
  const merged = mergeIntegrations(storedGd, { google_drive: { retention_days: 14 } }).google_drive;
  expect(merged?.client_secret).toBe('csecret'); // secret kept
  expect(merged?.retention_days).toBe(14);
  expect(merged?.refresh_token).toBe('rtok'); // server field carried over
  expect(merged?.folder_id).toBe('F1');
});

test('§9.6 merge clears client_secret on "" and replaces on a value', () => {
  expect(
    mergeIntegrations(storedGd, { google_drive: { client_secret: '' } }).google_drive
      ?.client_secret,
  ).toBeUndefined();
  expect(
    mergeIntegrations(storedGd, { google_drive: { client_secret: 'new' } }).google_drive
      ?.client_secret,
  ).toBe('new');
});

test('§9.6 patch strips the server-written fields (refresh_token/folder_id/last_*)', () => {
  const parsed = GoogleDrivePatchSchema.parse({
    retention_days: 10,
    refresh_token: 'x',
    folder_id: 'y',
    last_status: 'ok',
  });
  expect(parsed).toEqual({ retention_days: 10 });
});

test('§9.6 create google_drive from null applies the defaults', () => {
  const merged = mergeIntegrations(
    { home_assistant: null, barclaude_gateway: null, google_drive: null },
    { google_drive: { client_id: 'cid', client_secret: 'csecret' } },
  ).google_drive;
  expect(merged).toEqual({
    client_id: 'cid',
    client_secret: 'csecret',
    enabled: false,
    retention_days: 7,
    time_of_day: '03:00',
  });
});

test('§2 retention_days 1..90 and time_of_day HH:MM validation codes', () => {
  const firstIssue = (input: unknown): string | undefined => {
    const res = GoogleDrivePatchSchema.safeParse(input);
    return res.success ? undefined : res.error.issues[0]?.message;
  };
  expect(firstIssue({ retention_days: 0 })).toBe('invalid_retention_days');
  expect(firstIssue({ retention_days: 100 })).toBe('invalid_retention_days');
  expect(firstIssue({ time_of_day: '3:00' })).toBe('invalid_time_of_day');
  expect(firstIssue({ time_of_day: '24:00' })).toBe('invalid_time_of_day');
});
