import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import {
  DRIVE_FILES_URL,
  DRIVE_UPLOAD_URL,
  REVOKE_URL,
  TOKEN_URL,
} from '../../src/services/gdrive/constants.js';
import { authedAgent, csrfPatch, type Authed } from './helpers.js';

// Google Drive backup — OAuth handshake + actions with a stubbed outbound fetch (B-208;
// spec/api/integrations.md, integrations-connections.md §9). Asserts: config redaction
// (secrets never returned), the HTTPS/config gates, the connect→callback token store,
// backup-now upload + rotation, and disconnect. The real Google flow is owner-validated.
const app = createApp();

const CREDS = { client_id: 'cid', client_secret: 'csecret', enabled: true };

const json = (obj: unknown, status = 200): Response =>
  new Response(JSON.stringify(obj), { status });

type Files = { id: string; name: string }[];

function tokenReply(body: string): Response {
  return body.includes('grant_type=authorization_code')
    ? json({ refresh_token: 'rtok', access_token: 'atok' })
    : json({ access_token: 'atok' });
}

function driveReply(method: string, listFiles: Files): Response {
  if (method === 'POST') return json({ id: 'F1' }); // folder create
  if (method === 'DELETE') return new Response(null, { status: 204 }); // 204 must have a null body
  return json({ files: listFiles }); // GET: folder find / list
}

function route(url: string, method: string, body: string, listFiles: Files): Response {
  if (url === TOKEN_URL) return tokenReply(body);
  if (url.startsWith(DRIVE_UPLOAD_URL)) return json({ id: 'uploaded' });
  if (url.startsWith(REVOKE_URL)) return new Response('', { status: 200 });
  if (url.startsWith(DRIVE_FILES_URL)) return driveReply(method, listFiles);
  return json({});
}

/** Stub the global fetch to answer Google's OAuth + Drive endpoints. */
function stubGoogle(listFiles: Files = []): ReturnType<typeof vi.fn> {
  const fn = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? init.body : '';
    return Promise.resolve(route(url, method, body, listFiles));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

// The Drive flow only runs over HTTPS (ADR-0004), simulated here with the trusted-proxy header.
// These requests deliberately bypass the agent and carry `a.cookies` themselves: since B-232 the
// response marks the session cookie `Secure`, which the agent's jar would then withhold from every
// later plain-HTTP request in the same test. A real browser on a real HTTPS proxy keeps sending it —
// that is what the explicit header models, and keeping it out of the jar keeps the two hops honest.
function httpsReq(a: Authed, method: 'get' | 'post', url: string) {
  return request(app)[method](url).set('Cookie', a.cookies).set('X-Forwarded-Proto', 'https');
}

function connectReq(a: Authed) {
  return httpsReq(a, 'post', '/api/v1/integrations/google-drive/connect').set(
    'x-csrf-token',
    a.csrf,
  );
}

/** Drive an account through configure → connect → callback so it is connected. */
async function connectDrive(a: Authed): Promise<void> {
  await csrfPatch(a.agent, a.csrf, '/api/v1/settings', { integrations: { google_drive: CREDS } });
  stubGoogle();
  const connect = await connectReq(a);
  expect(connect.status).toBe(200);
  const state = new URL(connect.body.data.auth_url as string).searchParams.get('state') ?? '';
  const cb = await httpsReq(
    a,
    'get',
    `/api/v1/integrations/google-drive/callback?code=fakecode&state=${state}`,
  );
  expect(cb.status).toBe(302);
  expect(cb.headers.location).toBe('/settings?gdrive=connected');
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

describe('settings — google_drive config (B-208)', () => {
  it('stores the client creds and redacts secrets to *_set booleans', async () => {
    const a = await authedAgent(app, 'alice');
    const res = await csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
      integrations: {
        google_drive: {
          ...CREDS,
          retention_days: 14,
          time_of_day: '02:30',
          time_zone: 'Europe/Paris', // B-220 — round-trips through Zod → merge → persist → redact
        },
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.integrations.google_drive).toEqual({
      client_id: 'cid',
      client_secret_set: true,
      refresh_token_set: false,
      folder_id: null,
      enabled: true,
      retention_days: 14,
      time_of_day: '02:30',
      time_zone: 'Europe/Paris',
      last_backup_at: null,
      last_status: null,
      last_error: null,
    });
    expect(JSON.stringify(res.body)).not.toContain('csecret');
  });

  it('rejects a bad retention / time with 422 field details', async () => {
    const a = await authedAgent(app, 'alice');
    const badRetention = await csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
      integrations: { google_drive: { retention_days: 0 } },
    });
    expect(badRetention.status).toBe(422);
    expect(badRetention.body.error.details['integrations.google_drive.retention_days']).toBe(
      'invalid_retention_days',
    );
    const badTime = await csrfPatch(a.agent, a.csrf, '/api/v1/settings', {
      integrations: { google_drive: { time_of_day: '24:00' } },
    });
    expect(badTime.status).toBe(422);
    expect(badTime.body.error.details['integrations.google_drive.time_of_day']).toBe(
      'invalid_time_of_day',
    );
  });
});

describe('google_drive connect gates (B-208)', () => {
  it('over plain HTTP → 409 gdrive_insecure_context (no outbound call)', async () => {
    const a = await authedAgent(app, 'alice');
    await csrfPatch(a.agent, a.csrf, '/api/v1/settings', { integrations: { google_drive: CREDS } });
    const fn = vi.fn();
    vi.stubGlobal('fetch', fn);
    const res = await a.agent
      .post('/api/v1/integrations/google-drive/connect')
      .set('x-csrf-token', a.csrf);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('gdrive_insecure_context');
    expect(fn).not.toHaveBeenCalled();
  });

  it('HTTPS but no client creds → 409 gdrive_not_configured', async () => {
    const a = await authedAgent(app, 'alice');
    const res = await connectReq(a);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('gdrive_not_configured');
  });

  it('HTTPS + creds → 200 with a drive.file consent URL carrying state', async () => {
    const a = await authedAgent(app, 'alice');
    await csrfPatch(a.agent, a.csrf, '/api/v1/settings', { integrations: { google_drive: CREDS } });
    const res = await connectReq(a);
    expect(res.status).toBe(200);
    const url = new URL(res.body.data.auth_url as string);
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('redirect_uri')).toContain(
      '/api/v1/integrations/google-drive/callback',
    );
  });
});

describe('google_drive callback + status + disconnect (B-208)', () => {
  it('valid state stores the refresh token and reports connected; secret never returned', async () => {
    const a = await authedAgent(app, 'alice');
    await connectDrive(a);

    const status = await a.agent.get('/api/v1/integrations/google-drive/status');
    expect(status.status).toBe(200);
    expect(status.body.data.connected).toBe(true);
    expect(status.body.data.folder_url).toContain('F1');

    const read = await a.agent.get('/api/v1/settings');
    expect(read.body.data.integrations.google_drive.refresh_token_set).toBe(true);
    expect(JSON.stringify(read.body)).not.toContain('rtok');
    expect(JSON.stringify(read.body)).not.toContain('csecret');
  });

  it('bad state → redirect with an error marker, no token stored', async () => {
    const a = await authedAgent(app, 'alice');
    await csrfPatch(a.agent, a.csrf, '/api/v1/settings', { integrations: { google_drive: CREDS } });
    stubGoogle();
    await connectReq(a); // establishes a session state
    const cb = await httpsReq(
      a,
      'get',
      '/api/v1/integrations/google-drive/callback?code=x&state=wrong-state',
    );
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toBe('/settings?gdrive_error=gdrive_oauth_failed');
    const status = await a.agent.get('/api/v1/integrations/google-drive/status');
    expect(status.body.data.connected).toBe(false);
  });

  it('disconnect clears the token but keeps the client creds', async () => {
    const a = await authedAgent(app, 'alice');
    await connectDrive(a);
    const res = await a.agent
      .post('/api/v1/integrations/google-drive/disconnect')
      .set('x-csrf-token', a.csrf);
    expect(res.status).toBe(200);
    const read = await a.agent.get('/api/v1/settings');
    const gd = read.body.data.integrations.google_drive;
    expect(gd.refresh_token_set).toBe(false);
    expect(gd.client_secret_set).toBe(true); // creds kept for 1-click reconnect
    expect(gd.enabled).toBe(false);
  });
});

describe('google_drive backup-now (B-208)', () => {
  it('not connected → 409 gdrive_not_connected', async () => {
    const a = await authedAgent(app, 'alice');
    await csrfPatch(a.agent, a.csrf, '/api/v1/settings', { integrations: { google_drive: CREDS } });
    const res = await a.agent
      .post('/api/v1/integrations/google-drive/backup-now')
      .set('x-csrf-token', a.csrf);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('gdrive_not_connected');
  });

  it('connected → uploads, rotates the out-of-window files, records ok; no secret leaks', async () => {
    const a = await authedAgent(app, 'alice');
    await connectDrive(a);
    // Re-stub: an out-of-window backup exists and must be rotated out.
    const fn = stubGoogle([{ id: 'old', name: 'macronome-backup-2020-01-01T000000Z.json' }]);
    const res = await a.agent
      .post('/api/v1/integrations/google-drive/backup-now')
      .set('x-csrf-token', a.csrf);
    expect(res.status).toBe(200);
    expect(res.body.data.last_status).toBe('ok');
    expect(JSON.stringify(res.body)).not.toContain('rtok');

    const calls = fn.mock.calls as [string, RequestInit | undefined][];
    expect(calls.some(([url]) => url.startsWith(DRIVE_UPLOAD_URL))).toBe(true);
    expect(
      calls.some(([url, init]) => url.includes('/old') && (init?.method ?? 'GET') === 'DELETE'),
    ).toBe(true);

    const status = await a.agent.get('/api/v1/integrations/google-drive/status');
    expect(status.body.data.last_status).toBe('ok');
    expect(status.body.data.last_backup_at).toBeTruthy();
  });
});
