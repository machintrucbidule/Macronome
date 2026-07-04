import { expect, test } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e smoke for B-181 (Intégrations page): reach the page from the account menu, save a
// Home Assistant config, reload, and assert it persisted with the secret masked (never
// echoed). No outbound HA/gateway call is made (the Tester proxies are not exercised).
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const USER = 'e2e_integrations';
const PASSWORD = 'correct-horse-battery';

test.beforeAll(async () => {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  await prisma.appUser.upsert({
    where: { username: USER },
    update: { passwordHash, settings: {} },
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

test('configure Home Assistant → persists across reload with the token masked', async ({
  page,
  playwright,
}) => {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:5173' });
  await api.get('/api/v1/auth/session');
  const csrf =
    (await api.storageState()).cookies.find((c) => c.name === 'macronome.csrf')?.value ?? '';
  await api.post('/api/v1/auth/login', {
    headers: { 'x-csrf-token': csrf },
    data: { username: USER, password: PASSWORD },
  });
  await page.context().addCookies((await api.storageState()).cookies);

  // Reach the page from the account menu (desktop dropdown).
  await page.goto('/');
  await page.locator('summary').last().click();
  await page.getByRole('link', { name: 'Intégrations' }).click();
  await expect(page).toHaveURL(/\/integrations$/);

  // Fill + save the HA card.
  await page.getByPlaceholder('http://192.168.1.10:8123').fill('http://192.168.1.20:8123');
  await page.getByPlaceholder('Colle ton jeton').fill('e2e-secret-token');
  await page.getByPlaceholder('sensor.scale_weight').fill('sensor.test_scale_weight');
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();
  // The saved card re-seeds with the token masked ("•••• définie" placeholder).
  await expect(page.getByPlaceholder('•••• définie')).toBeVisible();

  // Reload → persisted + still masked, secret never in the DOM.
  await page.reload();
  await expect(page.locator('input[value="http://192.168.1.20:8123"]')).toBeVisible();
  await expect(page.locator('input[value="sensor.test_scale_weight"]')).toBeVisible();
  await expect(page.getByPlaceholder('•••• définie')).toBeVisible();
  expect(await page.content()).not.toContain('e2e-secret-token');
});
