import { expect, test } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e for the M9 login state card (design/components/states.md §Login). An owner account
// exists (so AppGate lets /login render); the server drives the states. We assert the
// generic error banner (bad credentials) and the lockout after repeated failures (the
// rate-limit / 429 path also covered server-side in packages/api auth integration tests).
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const PASSWORD = 'correct-horse-battery';

async function seedUser(username: string): Promise<void> {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  await prisma.appUser.upsert({
    where: { username },
    update: { passwordHash },
    create: {
      username,
      passwordHash,
      sex: 'male',
      birthdate: new Date('1986-01-01'),
      heightCm: 180,
    },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('shows a generic, non-enumerating error on bad credentials', async ({ page }) => {
  await seedUser('e2e_login_err');
  await page.goto('/login');

  await page.getByLabel('Identifiant').fill('e2e_login_err');
  await page.getByLabel('Mot de passe').fill('definitely-wrong');
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/login')),
    page.getByRole('button', { name: 'Se connecter' }).click(),
  ]);

  await expect(page.getByText('Identifiant ou mot de passe incorrect.')).toBeVisible();
  await expect(page.getByLabel('Identifiant')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Mot de passe')).toHaveAttribute('aria-invalid', 'true');
});

test('redirects a logged-out visitor of a protected route to /login (M9b)', async ({ page }) => {
  await seedUser('e2e_requireauth');
  // No session cookie in a fresh context → RequireAuth bounces /foods to /login.
  await page.goto('/foods');
  await page.waitForURL('**/login');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();

  // A successful login then lands on the app home (Repas).
  await page.getByLabel('Identifiant').fill('e2e_requireauth');
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('http://localhost:5173/');
  await expect(page.getByRole('link', { name: 'Aliments' })).toBeVisible();
});

test('locks out with a countdown after repeated failures (submit hidden)', async ({ page }) => {
  await seedUser('e2e_login_lock');
  await page.goto('/login');

  await page.getByLabel('Identifiant').fill('e2e_login_lock');
  // Limit is 5 failed attempts; the 6th is blocked with 429 locked_out (rateLimit.ts).
  for (let i = 0; i < 6; i += 1) {
    await page.getByLabel('Mot de passe').fill('definitely-wrong');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/auth/login')),
      page.getByRole('button', { name: 'Se connecter' }).click(),
    ]);
  }

  await expect(page.getByText(/Trop de tentatives/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toHaveCount(0);
});
