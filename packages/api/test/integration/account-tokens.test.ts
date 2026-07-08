import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { authedAgent, csrfPost, getCookie, type Authed } from './helpers.js';

// Token links (spec/api/users-admin.md §Token endpoints + 00-conventions §7,
// B-193/B-194): admin creation/list/revoke, the §7 carve-out registration, and
// the password-reset flow (consume + session revocation). Single-use = the row
// is deleted; only the sha256 of the raw token is ever stored.
const app = createApp();

const sha256 = (raw: string): string => createHash('sha256').update(raw).digest('hex');

async function adminAgent(appRef: Express, username: string): Promise<Authed> {
  const a = await authedAgent(appRef, username);
  await prisma.appUser.update({ where: { id: a.userId }, data: { isAdmin: true } });
  return a;
}

/** Anonymous cookie-primed agent (the first GET mints the csrf cookie). */
async function anonAgent() {
  const agent = request.agent(app);
  const pre = await agent.get('/api/v1/auth/session');
  return { agent, csrf: getCookie(pre, 'macronome.csrf') ?? '' };
}

const REGISTER_FIELDS = {
  username: 'newbie',
  password: 'correct-horse',
  sex: 'male',
  birthdate: '1992-03-04',
  height_cm: 175,
};

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('token links — admin endpoints', () => {
  it('are admin-gated (403 for a non-admin on all four)', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'pleb');
    const responses = [
      await csrfPost(agent, csrf, '/api/v1/users/invites', { is_admin: false }),
      await agent.get('/api/v1/users/tokens'),
      await agent.delete(`/api/v1/users/tokens/${userId}`).set('x-csrf-token', csrf),
      await csrfPost(agent, csrf, `/api/v1/users/${userId}/reset-token`),
    ];
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
    }
  });

  it('creates an invite (raw token returned once, only its hash stored)', async () => {
    const admin = await adminAgent(app, 'root');
    const res = await csrfPost(admin.agent, admin.csrf, '/api/v1/users/invites', {
      is_admin: true,
    });
    expect(res.status).toBe(201);
    const { id, token, expires_at, is_admin } = res.body.data;
    expect(is_admin).toBe(true);
    expect(new Date(expires_at).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 3600_000);

    const row = await prisma.accountToken.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).toBe(sha256(token));
    expect(row.tokenHash).not.toBe(token);
    expect(row.kind).toBe('invite');
    expect(row.userId).toBeNull();
  });

  it('lists pending links (username join) and purges expired rows first', async () => {
    const admin = await adminAgent(app, 'root');
    const bob = await authedAgent(app, 'bob');
    await csrfPost(admin.agent, admin.csrf, '/api/v1/users/invites', { is_admin: false });
    await csrfPost(admin.agent, admin.csrf, `/api/v1/users/${bob.userId}/reset-token`);
    await prisma.accountToken.create({
      data: {
        kind: 'invite',
        tokenHash: sha256('expired-raw'),
        expiresAt: new Date(Date.now() - 3600_000),
      },
    });

    const res = await admin.agent.get('/api/v1/users/tokens');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2); // the expired row was purged
    const kinds = res.body.data.map((tk: { kind: string }) => tk.kind).sort();
    expect(kinds).toEqual(['invite', 'password_reset']);
    const reset = res.body.data.find((tk: { kind: string }) => tk.kind === 'password_reset');
    expect(reset.username).toBe('bob');
    expect(reset.token).toBeUndefined(); // the secret is never listed
    expect(await prisma.accountToken.count()).toBe(2);
  });

  it('revokes a link (204, then 404)', async () => {
    const admin = await adminAgent(app, 'root');
    const created = await csrfPost(admin.agent, admin.csrf, '/api/v1/users/invites', {
      is_admin: false,
    });
    const id = created.body.data.id as string;

    const del = await admin.agent
      .delete(`/api/v1/users/tokens/${id}`)
      .set('x-csrf-token', admin.csrf);
    expect(del.status).toBe(204);
    const again = await admin.agent
      .delete(`/api/v1/users/tokens/${id}`)
      .set('x-csrf-token', admin.csrf);
    expect(again.status).toBe(404);
  });

  it('reset-token: guards self (own_account) and replaces the pending link', async () => {
    const admin = await adminAgent(app, 'root');
    const bob = await authedAgent(app, 'bob');

    const self = await csrfPost(
      admin.agent,
      admin.csrf,
      `/api/v1/users/${admin.userId}/reset-token`,
    );
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe('own_account');

    const first = await csrfPost(
      admin.agent,
      admin.csrf,
      `/api/v1/users/${bob.userId}/reset-token`,
    );
    const second = await csrfPost(
      admin.agent,
      admin.csrf,
      `/api/v1/users/${bob.userId}/reset-token`,
    );
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const rows = await prisma.accountToken.findMany({ where: { userId: bob.userId } });
    expect(rows).toHaveLength(1); // at most one active reset link per account
    expect(rows[0]!.tokenHash).toBe(sha256(second.body.data.token));
  });
});

describe('token links — registration (§7 carve-out, B-193)', () => {
  async function mintInvite(isAdmin: boolean): Promise<string> {
    const admin = await adminAgent(app, `root-${isAdmin ? 'a' : 'u'}`);
    const res = await csrfPost(admin.agent, admin.csrf, '/api/v1/users/invites', {
      is_admin: isAdmin,
    });
    return res.body.data.token as string;
  }

  it('registers an invited account with the invite role, consumes the token', async () => {
    const token = await mintInvite(false);
    const anon = await anonAgent();
    const res = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/register', {
      ...REGISTER_FIELDS,
      token,
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'newbie', is_admin: false });

    // Session open, defaults seeded, token gone.
    const session = await anon.agent.get('/api/v1/auth/session');
    expect(session.body.user.username).toBe('newbie');
    const user = await prisma.appUser.findUniqueOrThrow({ where: { username: 'newbie' } });
    expect(user.isAdmin).toBe(false);
    expect(user.lastLoginAt).not.toBeNull();
    expect(await prisma.mealSlotTemplate.count({ where: { userId: user.id } })).toBeGreaterThan(0);
    expect(await prisma.accountToken.count()).toBe(0);

    // Single-use: the same token is dead now.
    const again = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/register', {
      ...REGISTER_FIELDS,
      username: 'other',
      token,
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('token_invalid');
  });

  it('honours the admin role chosen at creation', async () => {
    const token = await mintInvite(true);
    const anon = await anonAgent();
    const res = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/register', {
      ...REGISTER_FIELDS,
      token,
    });
    expect(res.status).toBe(200);
    expect(res.body.user.is_admin).toBe(true);
  });

  it('username_taken does not consume the invite; expired/reset tokens are rejected', async () => {
    const token = await mintInvite(false);
    const anon = await anonAgent();
    const taken = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/register', {
      ...REGISTER_FIELDS,
      username: 'root-u', // the admin who minted the invite
      token,
    });
    expect(taken.status).toBe(409);
    expect(taken.body.error.code).toBe('username_taken');
    expect(await prisma.accountToken.count()).toBe(1); // still alive

    // An expired invite is token_invalid.
    await prisma.accountToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/register', {
      ...REGISTER_FIELDS,
      token,
    });
    expect(expired.status).toBe(409);
    expect(expired.body.error.code).toBe('token_invalid');
  });
});

describe('token links — password reset (B-194)', () => {
  it('sets the new password, consumes the token and revokes the sessions', async () => {
    const admin = await adminAgent(app, 'root');
    const bob = await authedAgent(app, 'bob'); // live session
    const created = await csrfPost(
      admin.agent,
      admin.csrf,
      `/api/v1/users/${bob.userId}/reset-token`,
    );
    const token = created.body.data.token as string;

    // token-state sees it as a reset link.
    const anon = await anonAgent();
    const state = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/token-state', { token });
    expect(state.body).toMatchObject({ valid: true, kind: 'password_reset' });

    const res = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/reset-password', {
      token,
      new_password: 'brand-new-pass',
    });
    expect(res.status).toBe(204);
    expect(await prisma.accountToken.count()).toBe(0);

    // Old session revoked; old password dead; new password works.
    expect((await bob.agent.get('/api/v1/foods')).status).toBe(401);
    const relog = await anonAgent();
    const bad = await csrfPost(relog.agent, relog.csrf, '/api/v1/auth/login', {
      username: 'bob',
      password: 'correct-horse',
    });
    expect(bad.status).toBe(401);
    const good = await csrfPost(relog.agent, relog.csrf, '/api/v1/auth/login', {
      username: 'bob',
      password: 'brand-new-pass',
    });
    expect(good.status).toBe(200);

    // Single-use.
    const reuse = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/reset-password', {
      token,
      new_password: 'another-pass',
    });
    expect(reuse.status).toBe(409);
    expect(reuse.body.error.code).toBe('token_invalid');
  });

  it('validates the body (422 under 8 chars) and rejects unknown tokens', async () => {
    const anon = await anonAgent();
    const short = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/reset-password', {
      token: 'whatever',
      new_password: 'short',
    });
    expect(short.status).toBe(422);

    const unknown = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/reset-password', {
      token: 'unknown-token',
      new_password: 'long-enough-pass',
    });
    expect(unknown.status).toBe(409);
    expect(unknown.body.error.code).toBe('token_invalid');

    const probe = await csrfPost(anon.agent, anon.csrf, '/api/v1/auth/token-state', {
      token: 'unknown-token',
    });
    expect(probe.status).toBe(200);
    expect(probe.body).toEqual({ valid: false });
  });

  it('cascade: deleting a user (B-192) removes their pending reset link', async () => {
    const admin = await adminAgent(app, 'root');
    const bob = await authedAgent(app, 'bob');
    await csrfPost(admin.agent, admin.csrf, `/api/v1/users/${bob.userId}/reset-token`);
    expect(await prisma.accountToken.count()).toBe(1);

    const del = await admin.agent
      .delete(`/api/v1/users/${bob.userId}`)
      .set('x-csrf-token', admin.csrf);
    expect(del.status).toBe(204);
    expect(await prisma.accountToken.count()).toBe(0);
  });
});
