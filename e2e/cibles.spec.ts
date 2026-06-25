import { expect, test } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e smoke for the Cibles screen (M2 acceptance): set a target, see the derived tiles,
// and trigger the negative carb-ceiling warning. Auth has no UI yet (login is an M0
// stub), so we seed the user + a current weigh-in directly and log in via the proxied
// API to obtain the session + CSRF cookies, then inject them into the browser context.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const USER = 'e2e_cibles';
const PASSWORD = 'correct-horse-battery';

test.beforeAll(async () => {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const user = await prisma.appUser.upsert({
    where: { username: USER },
    update: { passwordHash },
    create: {
      username: USER,
      passwordHash,
      sex: 'male',
      birthdate: new Date('1986-01-01'),
      heightCm: 180,
    },
  });
  // Reset this user's targets/weigh-ins for a deterministic run, then seed an 80 kg
  // weigh-in dated a few days ago (≤ today regardless of the wall clock).
  await prisma.target.deleteMany({ where: { userId: user.id } });
  await prisma.weightEntry.deleteMany({ where: { userId: user.id } });
  await prisma.weightEntry.create({
    data: {
      userId: user.id,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      weightKg: 80,
      dietFlag: 'in_diet',
    },
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('set an inconsistent target and see the negative carb-ceiling warning', async ({
  page,
  playwright,
}) => {
  // Log in via the proxied API (same origin as the SPA) and copy the cookies over.
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:5173' });
  await api.get('/api/v1/auth/session');
  const csrf =
    (await api.storageState()).cookies.find((c) => c.name === 'macronome.csrf')?.value ?? '';
  await api.post('/api/v1/auth/login', {
    headers: { 'x-csrf-token': csrf },
    data: { username: USER, password: PASSWORD },
  });
  await page.context().addCookies((await api.storageState()).cookies);

  await page.goto('/cibles');

  // Enter targets whose protein + fat floors exceed the calorie max → carb ceiling < 0.
  await page.getByLabel('Minimum').fill('1000');
  await page.getByLabel('Maximum').fill('1200');
  await page.getByLabel('Protéines').fill('2');
  await page.getByLabel('Lipides').fill('1');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  // The engine returns the real negative value (not clamped) + the inconsistency banner.
  // Scope to the carb-ceiling tile: the value is echoed in the carb derived-field too.
  // Macro grams render as integers (format.ts macroG → formatInt), so it is "-40", not "-40,0".
  await expect(page.getByTestId('carb-ceiling-tile')).toContainText('-40');
  await expect(page.getByText(/Cibles incohérentes/)).toBeVisible();
});
