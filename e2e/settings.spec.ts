import { expect, test, type Page } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e smoke for M7 (Settings & pantry): pin a food on a meal's garde-manger from Paramètres,
// see it pre-fill a new day's meal, then unpin and see future days no longer pre-fill it.
// Auth has no UI yet (login is a stub), so we seed a user + the default template and log in
// via the proxied API to obtain the session/CSRF cookies, then inject them into the browser.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const USER = 'e2e_settings';
const PASSWORD = 'correct-horse-battery';
const FOOD_NAME = `E2E Pin ${Date.now()}`;
const SLOTS = ['Petit déjeuner', 'Déjeuner', 'Dîner', 'Collation'];

test.beforeAll(async () => {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const user = await prisma.appUser.upsert({
    where: { username: USER },
    update: { passwordHash },
    create: {
      username: USER,
      passwordHash,
      sex: 'male',
      birthdate: new Date('1990-01-01'),
      heightCm: 180,
    },
    select: { id: true },
  });
  // Reset the per-user pantry + template, then seed the default day structure.
  await prisma.pantryItem.deleteMany({ where: { userId: user.id } });
  await prisma.mealSlotTemplate.deleteMany({ where: { userId: user.id } });
  await prisma.mealSlotTemplate.createMany({
    data: SLOTS.map((name, orderIndex) => ({ userId: user.id, name, orderIndex })),
  });
  await prisma.food.create({
    data: {
      ownerId: user.id,
      name: FOOD_NAME,
      normalizedName: FOOD_NAME.toLowerCase(),
      kcalPer100g: 100,
      fatPer100g: 1,
      carbPer100g: 2,
      proteinPer100g: 3,
    },
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

// B-209 made the Paramètres cards collapsible and "Structure de journée par défaut" starts
// collapsed, so its garde-manger controls are not in the DOM until the title row is clicked.
// Must run after every navigation to /settings — otherwise an assertion on hidden content
// passes for the wrong reason.
async function openTemplateCard(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Structure de journée par défaut' }).click();
}

test('pin a food in settings → it pre-fills a new day; unpin → future-only', async ({
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

  // Pin the food on the first meal's garde-manger.
  await page.goto('/settings');
  await openTemplateCard(page);
  await page.getByRole('button', { name: '+ Aliment' }).first().click();
  await page.getByPlaceholder('Rechercher un aliment…').fill(FOOD_NAME);
  await page.getByText(FOOD_NAME).click();
  await expect(page.getByText(FOOD_NAME)).toBeVisible();

  // A brand-new day now pre-fills it under the first meal.
  await page.goto('/day/2026-12-15');
  await expect(page.getByText(FOOD_NAME)).toBeVisible();

  // Unpin from settings → future days no longer pre-fill it. Target the chip's own remove
  // button via its test id (the chip also has a unit button, and meal rows a × delete).
  await page.goto('/settings');
  await openTemplateCard(page);
  await page.getByTestId('pantry-remove').click();
  await expect(page.getByText(FOOD_NAME)).toHaveCount(0);

  await page.goto('/day/2026-12-16');
  await expect(page.getByText(FOOD_NAME)).toHaveCount(0);
});
