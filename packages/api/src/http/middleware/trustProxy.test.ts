import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// config/env.ts self-loads at import (needs DATABASE_URL, would exit the process); mock it so
// importing applyTrustProxy is safe in the unit context. The behavioural cases below set
// `trust proxy` directly and don't depend on the mock.
vi.mock('../../config/env.js', () => ({ env: { TRUSTED_PROXY: 'loopback, uniquelocal' } }));

import { applyTrustProxy } from './trustProxy.js';

function probe(trust: string): express.Express {
  const app = express();
  app.set('trust proxy', trust);
  app.get('/p', (req, res) => {
    res.json({ ip: req.ip, secure: req.secure });
  });
  return app;
}

// XFF = "<real client>, <internal proxy hop>". Express evaluates trust from the socket peer
// (loopback under supertest) leftwards; req.ip is the first UNtrusted address.
const XFF = '203.0.113.5, 192.168.1.10';

describe('trust proxy value behaviour', () => {
  it('default (loopback, uniquelocal) trusts the private-range proxy hop → real client IP + https', async () => {
    const res = await request(probe('loopback, uniquelocal'))
      .get('/p')
      .set('X-Forwarded-For', XFF)
      .set('X-Forwarded-Proto', 'https');
    expect(res.body.ip).toBe('203.0.113.5'); // walked past the trusted 192.168.x hop
    expect(res.body.secure).toBe(true); // X-Forwarded-Proto honoured
  });

  it('loopback alone does NOT trust the private-range hop (it becomes req.ip)', async () => {
    const res = await request(probe('loopback'))
      .get('/p')
      .set('X-Forwarded-For', XFF)
      .set('X-Forwarded-Proto', 'https');
    expect(res.body.ip).toBe('192.168.1.10'); // the container/tunnel peer is untrusted → shared bucket
  });
});

describe('applyTrustProxy', () => {
  it('sets Express trust proxy to the configured env value', () => {
    const app = express();
    applyTrustProxy(app);
    expect(app.get('trust proxy')).toBe('loopback, uniquelocal');
  });
});
