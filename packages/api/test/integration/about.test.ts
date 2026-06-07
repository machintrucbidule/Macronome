import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent } from './helpers.js';

// GET /api/v1/about (spec/api/system-info.md): app + server/runtime snapshot, authenticated.
const app = createApp();

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/about', () => {
  it('returns the app + server snapshot to an authenticated owner', async () => {
    const { agent } = await authedAgent(app, 'alice');
    const res = await agent.get('/api/v1/about');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.app).toMatchObject({ name: 'Macronome' });
    expect(typeof d.app.version).toBe('string');
    expect((d.runtime.node_version as string).startsWith('v')).toBe(true);
    expect(typeof d.runtime.uptime_s).toBe('number');
    expect((d.system.platform as string).length).toBeGreaterThan(0);
    expect(Array.isArray(d.system.load_avg)).toBe(true);
    expect(d.system.load_avg).toHaveLength(3);
    expect(typeof d.process_memory.rss_bytes).toBe('number');
    expect(d.database.server_version).toContain('PostgreSQL');
    expect(typeof d.database.size_bytes).toBe('number');
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/about');
    expect(res.status).toBe(401);
  });
});
