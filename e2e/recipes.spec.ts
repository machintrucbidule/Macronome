import { expect, test, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e smoke for the Recettes screen (M5 acceptance): build a recipe from a seeded food,
// save it (the server builds the derived food + auto "portion"), then log "1 portion" on a
// day — tying back to M3. Auth has no UI yet, so we seed the user + target + weigh-in + a
// food directly, log in via the proxied API to get the session + CSRF cookies, then inject
// them. Runs serially so the one-time seeding can't race itself.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

test.describe.configure({ mode: 'serial' });

const USER = 'e2e_recipes';
const PASSWORD = 'correct-horse-battery';
const FOOD = 'Farine Test';
const RECIPE = `E2E Cake ${Date.now()}`;

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

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
  await prisma.dayLog.deleteMany({ where: { userId: user.id } });
  await prisma.recipe.deleteMany({ where: { ownerId: user.id } });
  await prisma.food.deleteMany({ where: { ownerId: user.id } });
  await prisma.target.deleteMany({ where: { userId: user.id } });
  await prisma.weightEntry.deleteMany({ where: { userId: user.id } });
  await prisma.weightEntry.create({
    data: { userId: user.id, date: new Date(daysAgoIso(40)), weightKg: 80, dietFlag: 'in_diet' },
  });
  await prisma.target.create({
    data: {
      userId: user.id,
      calorieMin: 100,
      calorieMax: 500,
      proteinGPerKg: 1.5,
      fatGPerKg: 0.8,
      effectiveFrom: new Date(daysAgoIso(40)),
    },
  });
  await prisma.food.create({
    data: {
      ownerId: user.id,
      name: FOOD,
      normalizedName: 'farine test',
      kcalPer100g: 200,
      fatPer100g: 0,
      carbPer100g: 50,
      proteinPer100g: 0,
    },
  });
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

test('build a recipe, save it, then log one portion on a day', async ({ page, playwright }) => {
  await login(page, playwright);

  // Build the recipe: 100 g of the seeded food, 1 serving → derived 200 kcal/100 g, portion 100 g.
  await page.goto('/recipes');
  await page.getByRole('button', { name: '+ Ajouter une recette' }).click();
  await page.getByPlaceholder('Gâteau aux pommes').fill(RECIPE);
  await page.getByRole('button', { name: '+ Ajouter un ingrédient' }).click();
  await page.getByPlaceholder(/Rechercher un aliment ou une recette/).fill('Farine');
  await page.getByText(FOOD).first().click();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  // It appears in the recipes list with the server-computed per-100 g (200).
  await expect(page.getByRole('cell', { name: RECIPE })).toBeVisible();

  // Log "1 portion" of it on a day (the derived food is loggable like any food).
  const date = daysAgoIso(7);
  await page.goto(`/day/${date}`);
  await page.getByText('+ aliment').first().click();
  await page.getByText(RECIPE).first().click();

  // Set the quantity to 1, then switch the unit to the recipe's auto "portion": the unit
  // change is the last mutation, so the server recomputes 1 portion (100 g) deterministically.
  const qty = page.locator('input[data-meal-qty]').first();
  await qty.fill('1');
  await qty.press('Enter');
  await qty.locator('xpath=following-sibling::span[1]').click();
  await page.getByRole('button', { name: /portion \(/ }).click();

  // 1 portion = 100 g × 200 kcal/100 g = 200 kcal, computed server-side.
  await expect(page.getByText('200 kcal')).toBeVisible();
});
