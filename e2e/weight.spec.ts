import { expect, test, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e for the Poids screen (M4 acceptance): adding weigh-ins draws the EMA + trajectory and
// derives a period; editing a weigh-in's date re-derives the period. Auth has no UI yet, so
// we seed the user directly, log in via the proxied API for the session + CSRF cookies, then
// inject them. This file's tests share one user → run serially and clear weigh-ins up front.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

test.describe.configure({ mode: 'serial' });

const USER = 'e2e_weight';
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
  await prisma.weightEntry.deleteMany({ where: { userId: user.id } });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function login(page: Page, playwright: PlaywrightWorkerArgs['playwright']): Promise<void> {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:5173' });
  await api.get('/api/v1/auth/session');
  const csrf =
    (await api.storageState()).cookies.find((c) => c.name === 'macronome.csrf')?.value ?? '';
  await api.post('/api/v1/auth/login', {
    headers: { 'x-csrf-token': csrf },
    data: { username: USER, password: PASSWORD },
  });
  await page.context().addCookies((await api.storageState()).cookies);
}

/** Open the weigh-in modal, fill date + weight, and save (default diet flag). */
async function addWeighIn(page: Page, date: string, weight: string): Promise<void> {
  await page.getByRole('button', { name: '+ Pesée' }).click();
  await page.getByLabel('Date').fill(date);
  await page.getByLabel('Poids').fill(weight);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
}

test('weigh-ins draw the trend/trajectory + a period; editing a date re-derives it', async ({
  page,
  playwright,
}) => {
  await login(page, playwright);
  await page.goto('/weight');

  await addWeighIn(page, '2026-02-10', '80');
  await addWeighIn(page, '2026-02-17', '79');

  // The chart renders (EMA + trajectory legend) and a 7-day period appears.
  await expect(page.getByText('Tendance lissée')).toBeVisible();
  await expect(page.getByText('Trajectoire cible')).toBeVisible();
  const period = page.locator('tr[data-period="2026-02-17"]');
  await expect(period).toBeVisible();
  await expect(period.locator('td').nth(1)).toHaveText('7');

  // Editing the second weigh-in's date to +14 re-derives the period (now 14 days).
  await period.click();
  await page.getByLabel('Date').fill('2026-02-24');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.locator('tr[data-period="2026-02-17"]')).toHaveCount(0);
  const rederived = page.locator('tr[data-period="2026-02-24"]');
  await expect(rederived).toBeVisible();
  await expect(rederived.locator('td').nth(1)).toHaveText('14');
});

test('the Régime/Maintien mode persists across a reload (B-177)', async ({ page, playwright }) => {
  // Seed a weigh-in (so current_mode is non-null → the header mode toggle shows) and reset
  // settings (deterministic start = régime) directly, avoiding the weigh-in modal which has
  // its own flag toggle. The toggle under test is the header one.
  const user = await prisma.appUser.findUniqueOrThrow({ where: { username: USER } });
  await prisma.weightEntry.upsert({
    where: { userId_date: { userId: user.id, date: new Date('2026-03-10') } },
    update: { weightKg: 80, dietFlag: 'in_diet' },
    create: { userId: user.id, date: new Date('2026-03-10'), weightKg: 80, dietFlag: 'in_diet' },
  });
  await prisma.appUser.update({ where: { id: user.id }, data: { settings: {} } });

  await login(page, playwright);
  await page.goto('/weight');

  const maintien = page.getByRole('button', { name: 'Maintien' });
  // Seeded from the weigh-in's flag: régime is selected by default.
  await expect(page.getByRole('button', { name: 'En régime' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Switch to Maintien and wait for the persist PATCH /settings to land.
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/v1/settings') && r.request().method() === 'PATCH',
    ),
    maintien.click(),
  ]);
  await expect(maintien).toHaveAttribute('aria-pressed', 'true');

  // Reload: the mode survives (persisted), instead of reverting to "En régime".
  await page.reload();
  await expect(page.getByRole('button', { name: 'Maintien' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
