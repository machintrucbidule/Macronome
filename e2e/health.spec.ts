import { expect, test } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// Proves the full round-trip: browser → Vite proxy → API → Postgres → render. The /health
// page is gated by RequireAuth (M9b), so we seed an owner and log in via the proxied API,
// copying the session + CSRF cookies into the browser context (same pattern as foods.spec).
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const USER = 'e2e_health';
const PASSWORD = 'correct-horse-battery';

test.beforeAll(async () => {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  await prisma.appUser.upsert({
    where: { username: USER },
    update: { passwordHash },
    create: {
      username: USER,
      passwordHash,
      sex: 'male',
      birthdate: new Date('1990-01-01'),
      heightCm: 180,
    },
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('health round-trip renders the connected state', async ({ page, playwright }) => {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:5173' });
  await api.get('/api/v1/auth/session');
  const csrf =
    (await api.storageState()).cookies.find((c) => c.name === 'macronome.csrf')?.value ?? '';
  await api.post('/api/v1/auth/login', {
    headers: { 'x-csrf-token': csrf },
    data: { username: USER, password: PASSWORD },
  });
  await page.context().addCookies((await api.storageState()).cookies);

  // Repas is the home route (M3b); the M0 health round-trip lives at /health.
  await page.goto('/health');
  await expect(page.getByTestId('health-ok')).toBeVisible();
});
