import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/data/prisma.js';
import { userRepo } from '../../src/data/repositories/user.repo.js';
import { authedAgent } from './helpers.js';

// B-190 — the upgrade migration's promote backfill, and the last_seen_at activity
// stamp (throttled to one write per 5 minutes since B-239). The ALTERs are exercised by CI's migrate
// step on a fresh database; here we re-run the shipped UPDATE out of migration
// context to verify its promote semantics against a pre-upgrade-shaped row.
const app = createApp();

const MIGRATION_SQL = fileURLToPath(
  new URL(
    '../../prisma/migrations/20260708130000_user_admin_last_login/migration.sql',
    import.meta.url,
  ),
);

async function seedStandardUser(username: string): Promise<{ id: string }> {
  const passwordHash = await argon2.hash('correct-horse', { type: argon2.argon2id });
  return prisma.appUser.create({
    data: {
      username,
      passwordHash,
      sex: 'male',
      birthdate: new Date('1990-01-01'),
      heightCm: 180,
    },
    select: { id: true },
  });
}

function setLastSeen(id: string, at: Date | null): Promise<unknown> {
  return prisma.appUser.update({ where: { id }, data: { lastSeenAt: at } });
}

async function lastSeen(id: string): Promise<Date | null> {
  const row = await prisma.appUser.findUniqueOrThrow({
    where: { id },
    select: { lastSeenAt: true },
  });
  return row.lastSeenAt;
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('user_admin_last_login migration — promote backfill (B-190)', () => {
  it('promotes users existing at upgrade time to admin', async () => {
    const user = await seedStandardUser('owner');
    const before = await prisma.appUser.findUniqueOrThrow({ where: { id: user.id } });
    expect(before.isAdmin).toBe(false); // pre-upgrade shape: column default

    const updates = readFileSync(MIGRATION_SQL, 'utf8')
      .split('\n')
      .filter((line) => line.trim().startsWith('UPDATE'));
    expect(updates.length).toBeGreaterThan(0); // the promote backfill must ship

    for (const statement of updates) {
      await prisma.$executeRawUnsafe(statement);
    }

    const after = await prisma.appUser.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.isAdmin).toBe(true);
  });
});

describe('last_seen_at activity stamp (B-190, 5-minute window per B-239)', () => {
  it('recordActivity stamps a null or stale (>5 min) last_seen_at', async () => {
    const user = await seedStandardUser('alice');
    expect(await lastSeen(user.id)).toBeNull();

    await userRepo.recordActivity(user.id);
    const first = await lastSeen(user.id);
    expect(first).not.toBeNull();

    // Just past the window: an hour-old stamp used to be needed, 6 minutes now suffice (B-239).
    const stale = new Date(Date.now() - 6 * 60_000);
    await setLastSeen(user.id, stale);
    await userRepo.recordActivity(user.id);
    const refreshed = await lastSeen(user.id);
    expect(refreshed!.getTime()).toBeGreaterThan(stale.getTime());
  });

  it('recordActivity is throttled: a recent (<5 min) stamp is left untouched', async () => {
    const user = await seedStandardUser('alice');
    const recent = new Date(Date.now() - 2 * 60_000);
    await setLastSeen(user.id, recent);

    await userRepo.recordActivity(user.id);
    expect((await lastSeen(user.id))!.getTime()).toBe(recent.getTime());
  });

  it('an authenticated request refreshes a stale last_seen_at (requireAuth path)', async () => {
    const { agent, userId } = await authedAgent(app, 'bob');
    const stale = new Date(Date.now() - 2 * 3600_000);
    await setLastSeen(userId, stale);

    const res = await agent.get('/api/v1/foods');
    expect(res.status).toBe(200);

    // The stamp is fire-and-forget behind the response — poll briefly.
    const deadline = Date.now() + 2_000;
    let seen = await lastSeen(userId);
    while ((seen === null || seen.getTime() <= stale.getTime()) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      seen = await lastSeen(userId);
    }
    expect(seen!.getTime()).toBeGreaterThan(stale.getTime());
  });
});
