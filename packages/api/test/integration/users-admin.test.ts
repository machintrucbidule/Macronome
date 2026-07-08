import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import * as usersAdminService from '../../src/services/users-admin.js';
import {
  authedAgent,
  csrfPatch,
  seedFood,
  seedTarget,
  seedWeight,
  type Authed,
} from './helpers.js';

// Admin user management (spec/api/users-admin.md, B-192): role gate, list shape,
// promote/demote, the own_account guard, and the full wipe-then-delete (data +
// account + sessions). The last_admin guard is unreachable through HTTP once
// own_account holds (the caller is always another admin) — tested at service level.
const app = createApp();

/** authedAgent, then promoted to admin (the role is re-read per request). */
async function adminAgent(appRef: Express, username: string): Promise<Authed> {
  const a = await authedAgent(appRef, username);
  await prisma.appUser.update({ where: { id: a.userId }, data: { isAdmin: true } });
  return a;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('users admin — role gate', () => {
  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 forbidden for a non-admin on all three endpoints', async () => {
    const { agent, csrf, userId } = await authedAgent(app, 'pleb');
    const get = await agent.get('/api/v1/users');
    const patch = await csrfPatch(agent, csrf, `/api/v1/users/${userId}`, { is_admin: true });
    const del = await agent.delete(`/api/v1/users/${userId}`).set('x-csrf-token', csrf);

    for (const res of [get, patch, del]) {
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: { code: 'forbidden' } });
    }
  });
});

describe('users admin — list', () => {
  it('lists account metadata, created_at ascending, nulls for a never-logged user', async () => {
    const admin = await adminAgent(app, 'root');
    await prisma.appUser.create({
      data: {
        username: 'ghost',
        passwordHash: 'x',
        sex: 'male',
        birthdate: new Date('1990-01-01'),
        heightCm: 180,
      },
    });

    const res = await admin.agent.get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((u: { username: string }) => u.username)).toEqual(['root', 'ghost']);

    const [root, ghost] = res.body.data;
    expect(root).toMatchObject({ username: 'root', is_admin: true });
    expect(typeof root.created_at).toBe('string');
    expect(root.last_login_at).not.toBeNull(); // authedAgent logged in
    expect(ghost).toMatchObject({
      username: 'ghost',
      is_admin: false,
      last_login_at: null,
      last_seen_at: null,
    });
    // Metadata only — never credentials/settings/profile.
    expect(Object.keys(root).sort()).toEqual([
      'created_at',
      'id',
      'is_admin',
      'last_login_at',
      'last_seen_at',
      'username',
    ]);
  });
});

describe('users admin — promote / demote', () => {
  it('promotes then demotes another account', async () => {
    const admin = await adminAgent(app, 'root');
    const bob = await authedAgent(app, 'bob');

    const up = await csrfPatch(admin.agent, admin.csrf, `/api/v1/users/${bob.userId}`, {
      is_admin: true,
    });
    expect(up.status).toBe(200);
    expect(up.body.data).toMatchObject({ username: 'bob', is_admin: true });

    const down = await csrfPatch(admin.agent, admin.csrf, `/api/v1/users/${bob.userId}`, {
      is_admin: false,
    });
    expect(down.status).toBe(200);
    expect(down.body.data.is_admin).toBe(false);
  });

  it('rejects acting on your own account (409 own_account)', async () => {
    const admin = await adminAgent(app, 'root');
    const patch = await csrfPatch(admin.agent, admin.csrf, `/api/v1/users/${admin.userId}`, {
      is_admin: false,
    });
    const del = await admin.agent
      .delete(`/api/v1/users/${admin.userId}`)
      .set('x-csrf-token', admin.csrf);

    for (const res of [patch, del]) {
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: { code: 'own_account' } });
    }
  });

  it('never drops below one admin (service-level last_admin race net)', async () => {
    const admin = await adminAgent(app, 'root'); // the only admin
    const bob = await authedAgent(app, 'bob'); // any other actor id

    await expect(usersAdminService.setRole(bob.userId, admin.userId, false)).rejects.toMatchObject({
      status: 409,
      code: 'last_admin',
    });
    await expect(usersAdminService.remove(bob.userId, admin.userId)).rejects.toMatchObject({
      status: 409,
      code: 'last_admin',
    });

    const row = await prisma.appUser.findUniqueOrThrow({ where: { id: admin.userId } });
    expect(row.isAdmin).toBe(true);
  });

  it('returns 404 for an unknown id and 422 for an invalid body', async () => {
    const admin = await adminAgent(app, 'root');
    const missing = await csrfPatch(admin.agent, admin.csrf, `/api/v1/users/${randomUUID()}`, {
      is_admin: true,
    });
    expect(missing.status).toBe(404);

    const bob = await authedAgent(app, 'bob');
    const empty = await csrfPatch(admin.agent, admin.csrf, `/api/v1/users/${bob.userId}`, {});
    const wrong = await csrfPatch(admin.agent, admin.csrf, `/api/v1/users/${bob.userId}`, {
      is_admin: 'yes',
    });
    expect(empty.status).toBe(422);
    expect(wrong.status).toBe(422);
  });
});

describe('users admin — delete wipes the account, its data and its sessions', () => {
  it('removes everything for the target and leaves the admin intact', async () => {
    const admin = await adminAgent(app, 'root');
    const bob = await authedAgent(app, 'bob'); // logged in → live session row
    await seedFood(bob.userId, 'Apple');
    await seedWeight(bob.userId, '2026-01-05', 80);
    await seedTarget(bob.userId, '2026-01-01');

    const res = await admin.agent
      .delete(`/api/v1/users/${bob.userId}`)
      .set('x-csrf-token', admin.csrf);
    expect(res.status).toBe(204);

    expect(await prisma.appUser.findUnique({ where: { id: bob.userId } })).toBeNull();
    expect(await prisma.food.count({ where: { ownerId: bob.userId } })).toBe(0);
    expect(await prisma.weightEntry.count({ where: { userId: bob.userId } })).toBe(0);
    expect(await prisma.target.count({ where: { userId: bob.userId } })).toBe(0);
    expect(await prisma.mealSlotTemplate.count({ where: { userId: bob.userId } })).toBe(0);
    expect(await prisma.container.count({ where: { ownerId: bob.userId } })).toBe(0);

    const sessions = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM "session" WHERE "sess"->>'userId' = ${bob.userId}`;
    expect(sessions[0]!.n).toBe(0);
    // The deleted user's agent is logged out for good.
    const after = await bob.agent.get('/api/v1/foods');
    expect(after.status).toBe(401);

    // The admin's own structure is untouched.
    expect(
      await prisma.mealSlotTemplate.count({ where: { userId: admin.userId } }),
    ).toBeGreaterThan(0);
    const unaffected = await admin.agent.get('/api/v1/users');
    expect(unaffected.status).toBe(200);
    expect(unaffected.body.data).toHaveLength(1);
  });
});
