import { expect, test, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e for the Repas screen (M3b acceptance): log a referenced line (totals/verdict update) and
// run the leftover flow (apply scales the consumed values; the block case warns and writes
// nothing). Auth has no UI yet, so we seed the user + a weigh-in + a target + a food directly,
// log in via the proxied API to get the session + CSRF cookies, then inject them. Each test
// works on its own date so the fully-parallel runs never collide.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

// One shared user/food/target seeded once → run this file's tests in a single worker (serial)
// so the beforeAll seeding can't race against itself. Each test still uses its own date.
test.describe.configure({ mode: 'serial' });

const USER = 'e2e_meals';
const PASSWORD = 'correct-horse-battery';
const FOOD = 'Poulet Test';

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
  // Deterministic state: clear this user's days/targets/weigh-ins/foods, then seed one of each.
  await prisma.dayLog.deleteMany({ where: { userId: user.id } });
  await prisma.target.deleteMany({ where: { userId: user.id } });
  await prisma.weightEntry.deleteMany({ where: { userId: user.id } });
  await prisma.food.deleteMany({ where: { ownerId: user.id } });
  await prisma.weightEntry.create({
    data: { userId: user.id, date: new Date(daysAgoIso(40)), weightKg: 80, dietFlag: 'in_diet' },
  });
  await prisma.target.create({
    data: {
      userId: user.id,
      calorieMin: 300,
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
      normalizedName: 'poulet test',
      kcalPer100g: 200,
      fatPer100g: 10,
      carbPer100g: 5,
      proteinPer100g: 25,
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

/** Add the seeded food to the first meal at `grams` g; leaves the day showing its totals. */
async function logFood(page: Page, date: string, grams: string): Promise<void> {
  await page.goto(`/day/${date}`);
  await page.getByText('+ aliment').first().click();
  await page.getByText(FOOD).first().click();
  const qty = page.locator('input[data-meal-qty]').first();
  await qty.fill(grams);
  await qty.press('Enter');
}

test('logging a referenced line updates the day totals', async ({ page, playwright }) => {
  await login(page, playwright);
  await logFood(page, daysAgoIso(10), '200');
  // 200 kcal/100g × 200 g = 400 kcal, computed by the server and rendered on the calorie card.
  await expect(page.getByTestId('day-total-kcal')).toContainText('400 kcal');
});

test('leftover deduction scales the consumed values', async ({ page, playwright }) => {
  await login(page, playwright);
  const date = daysAgoIso(11);
  await logFood(page, date, '200');
  await expect(page.getByTestId('day-total-kcal')).toContainText('400 kcal');

  await page
    .getByRole('button', { name: /Restes/ })
    .first()
    .click();
  await expect(page.getByText(/Déduire un reste/)).toBeVisible();
  await page.getByTestId('lo-gross').fill('50'); // net 50 < served 200 → coherent
  await page.getByRole('button', { name: 'Appliquer' }).click();

  // consumed = 200 − 50 = 150 g → 400 × 150/200 = 300 kcal.
  await expect(page.getByTestId('day-total-kcal')).toContainText('300 kcal');
});

test('leftover block warns and writes nothing', async ({ page, playwright }) => {
  await login(page, playwright);
  const date = daysAgoIso(12);
  await logFood(page, date, '200');
  await expect(page.getByTestId('day-total-kcal')).toContainText('400 kcal');

  await page
    .getByRole('button', { name: /Restes/ })
    .first()
    .click();
  await expect(page.getByText(/Déduire un reste/)).toBeVisible();
  await page.getByTestId('lo-gross').fill('300'); // net 300 > served 200 → blocked

  await expect(page.getByText(/dépasse le poids servi/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Appliquer' })).toBeDisabled();

  // Nothing written: closing leaves the day's totals unchanged. Exact name → the modal's
  // "Annuler" button, not the undo control ("Annuler (Ctrl+Z)").
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByTestId('day-total-kcal')).toContainText('400 kcal');
});

test('cook mode adjusts a quantity and writes it back', async ({ page, playwright }) => {
  await login(page, playwright);
  const date = daysAgoIso(13);
  await logFood(page, date, '200');
  await expect(page.getByTestId('day-total-kcal')).toContainText('400 kcal');

  // Open the near-fullscreen cook modal on the first meal.
  await page.getByRole('button', { name: 'Mode cuisine' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Tap the quantity (200) to enable the keypad, then type 100.
  await dialog.getByRole('button', { name: '200', exact: true }).click();
  await dialog.getByRole('button', { name: '1', exact: true }).click();
  await dialog.getByRole('button', { name: '0', exact: true }).click();
  await dialog.getByRole('button', { name: '0', exact: true }).click();
  await dialog.getByRole('button', { name: 'Valider' }).click();

  // 200 kcal/100g × 100 g = 200 kcal, recomputed by the server after the write-back.
  await expect(page.getByTestId('day-total-kcal')).toContainText('200 kcal');
});
