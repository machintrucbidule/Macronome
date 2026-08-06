import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveSpa } from './spa.js';

// B-287: the SPA was served with no cache policy at all — index.html, sw.js and the
// content-hashed assets all got the same `max-age=0`. The hashed URLs can never change
// meaning, so they are cached for a year; everything else must revalidate, a cached sw.js
// most of all (it would freeze the update path itself). Also pins the history fallback and
// the "unknown /api/* still 404s" invariant that spa.ts claims and nothing tested.
let dir: string;
const app = express();

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'macronome-spa-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'console.log(1)');
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Macronome</title>');
  writeFileSync(join(dir, 'sw.js'), 'self.addEventListener("install", () => {})');
  writeFileSync(join(dir, 'manifest.webmanifest'), '{"id":"/"}');
  app.get('/api/v1/health', (_req, res) => void res.json({ status: 'ok' }));
  serveSpa(app, dir);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('serveSpa cache policy', () => {
  it('caches content-hashed assets for a year, immutably', async () => {
    const res = await request(app).get('/assets/app-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it.each(['/index.html', '/sw.js', '/manifest.webmanifest'])('revalidates %s', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('revalidates the shell served by the history fallback', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Macronome');
    expect(res.headers['cache-control']).toBe('no-cache');
  });
});

describe('serveSpa routing', () => {
  it('leaves /api/* alone so unknown API paths still 404', async () => {
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    expect((await request(app).get('/api/v1/nope')).status).toBe(404);
  });
});
