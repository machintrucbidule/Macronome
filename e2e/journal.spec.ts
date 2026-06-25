import { expect, test, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e for the Journal screen (M3c acceptance): a logged day shows in the per-year table with
// its calories + verdict pill; forcing the verdict via the pill updates it; an inline comment
// persists; clicking a day opens its Repas. Auth has no UI yet, so we seed the user + a
// weigh-in + a target + a food directly, log in via the proxied API to get the session + CSRF
// cookies, then inject them. Each test logs its own date so the parallel runs never collide.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

// One shared user/food/target seeded once → run this file's tests serially so the beforeAll
// seeding can't race against itself. Each test still uses its own date.
test.describe.configure({ mode: 'serial' });

const USER = 'e2e_journal';
const PASSWORD = 'correct-horse-battery';
const FOOD = 'Poulet Journal';

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
  await prisma.target.deleteMany({ where: { userId: user.id } });
  await prisma.weightEntry.deleteMany({ where: { userId: user.id } });
  await prisma.food.deleteMany({ where: { ownerId: user.id } });
  await prisma.weightEntry.create({
    data: { userId: user.id, date: new Date(daysAgoIso(40)), weightKg: 80, dietFlag: 'in_diet' },
  });
  // cal range 300–500 → a 400 kcal day is OK.
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
      normalizedName: 'poulet journal',
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

/** Add the seeded food to the first meal of `date` at `grams` g (materializes the day). */
async function logFood(page: Page, date: string, grams: string): Promise<void> {
  await page.goto(`/day/${date}`);
  await page.getByText('+ aliment').first().click();
  await page.getByText(FOOD).first().click();
  const qty = page.locator('input[data-meal-qty]').first();
  await qty.fill(grams);
  await qty.press('Enter');
  // Scope to the day-total card: the per-meal MealTabs render the same "NNN kcal" string.
  await expect(page.getByTestId('day-total-kcal')).toContainText(
    `${Math.round((200 * Number(grams)) / 100)} kcal`,
  );
}

/** Open the Journal scoped to the year of `date` (default year is the current year). */
async function openJournal(page: Page, date: string): Promise<void> {
  await page.goto('/history');
  const nowYear = new Date().getFullYear();
  const target = Number(date.slice(0, 4));
  for (let y = nowYear; y > target; y--) {
    await page.getByRole('button', { name: 'Année précédente' }).click();
  }
  await expect(page.locator(`tr[data-date="${date}"]`)).toBeVisible();
}

test('a logged day appears in the journal with calories and an OK verdict', async ({
  page,
  playwright,
}) => {
  await login(page, playwright);
  const date = daysAgoIso(5);
  await logFood(page, date, '200'); // 400 kcal

  await openJournal(page, date);
  const row = page.locator(`tr[data-date="${date}"]`);
  await expect(row).toContainText('400');
  // The verdict pill is the only button in the row (activity is a <select>, comment an input).
  await expect(row.getByRole('button').first()).toHaveText(/^OK/);
});

test('forcing the verdict and editing a comment persist', async ({ page, playwright }) => {
  await login(page, playwright);
  const date = daysAgoIso(6);
  await logFood(page, date, '200');

  await openJournal(page, date);
  const row = page.locator(`tr[data-date="${date}"]`);

  // Force NOK via the pill menu → the badge flips to NOK.
  const pill = row.getByRole('button').first();
  await expect(pill).toHaveText(/^OK/);
  await pill.click();
  await row.getByRole('button', { name: 'Forcer NOK' }).click();
  await expect(pill).toHaveText(/^NOK/);

  // Inline comment saved on blur, then survives a reload.
  const comment = row.getByPlaceholder('Ajouter un commentaire…');
  await comment.fill('Journée test');
  await comment.blur();

  await openJournal(page, date);
  await expect(
    page.locator(`tr[data-date="${date}"]`).getByPlaceholder('Ajouter un commentaire…'),
  ).toHaveValue('Journée test');
});

test('clicking a day opens its Repas', async ({ page, playwright }) => {
  await login(page, playwright);
  const date = daysAgoIso(7);
  await logFood(page, date, '200');

  await openJournal(page, date);
  await page.locator(`tr[data-date="${date}"]`).locator('td').first().click();
  await expect(page).toHaveURL(new RegExp(`/day/${date}$`));
});
