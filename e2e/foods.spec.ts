import { expect, test } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e smoke for the Aliments screen (M1 acceptance): create a food, see it in search,
// archive it, see it disappear. Drives the SPA against the running stack. Auth has no
// UI yet (login is an M0 stub), so we seed a user and log in via the proxied API to
// obtain the session + CSRF cookies, then inject them into the browser context.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const USER = 'e2e_foods';
const PASSWORD = 'correct-horse-battery';
const FOOD_NAME = `E2E Crème ${Date.now()}`;

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

test('create a food, find it in search, then archive it', async ({ page, playwright }) => {
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

  await page.goto('/foods');

  // Create a food via the modal.
  await page.getByRole('button', { name: '+ Ajouter un aliment' }).click();
  await page.getByPlaceholder('Blancs de poulet').fill(FOOD_NAME);
  await page.getByLabel('Calories /100g').fill('292');
  await page.getByLabel('Lipides /100g').fill('30');
  await page.getByLabel('Glucides /100g').fill('3');
  await page.getByLabel('Protéines /100g').fill('2.4');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  // It appears in accent-insensitive search.
  await page.getByPlaceholder(/Rechercher/).fill(FOOD_NAME.replace('Crème', 'creme'));
  await expect(page.getByText(FOOD_NAME)).toBeVisible();

  // Archive it from the edit modal → confirm → it disappears from the list.
  await page.getByRole('row', { name: FOOD_NAME }).click();
  await page.getByRole('button', { name: 'Archiver' }).first().click();
  await page.getByRole('button', { name: 'Archiver' }).click();
  await expect(page.getByText(FOOD_NAME)).toHaveCount(0);
});
