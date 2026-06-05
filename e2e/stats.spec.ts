import { expect, test, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e for the Stats screen (M6 acceptance): with seeded logged days the rolling cards and
// the adherence heatmap render; a user with no logged days sees the empty state. Auth has
// no UI yet, so we seed the user directly, log in via the proxied API for the session +
// CSRF cookies, then inject them. Days are seeded in the current year so the default year
// selector surfaces them.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const YEAR = new Date().getFullYear();
const PASSWORD = 'correct-horse-battery';
const SNAPSHOT = {
  cal_min: 1550,
  cal_max: 1650,
  protein_floor_g: null,
  fat_floor_g: null,
  carb_ceiling_g: null,
};

async function seedUser(username: string): Promise<string> {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const user = await prisma.appUser.upsert({
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
  await prisma.dayLog.deleteMany({ where: { userId: user.id } });
  await prisma.target.deleteMany({ where: { userId: user.id } });
  return user.id;
}

async function seedSummaryDay(userId: string, date: string, kcal: number): Promise<void> {
  const auto = kcal >= SNAPSHOT.cal_min && kcal <= SNAPSHOT.cal_max ? 'OK' : 'NOK';
  await prisma.dayLog.create({
    data: {
      userId,
      date: new Date(`${date}T00:00:00.000Z`),
      kind: 'summary',
      summaryKcal: kcal,
      verdictAuto: auto,
      targetSnapshot: SNAPSHOT,
    },
  });
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function login(
  page: Page,
  playwright: PlaywrightWorkerArgs['playwright'],
  user: string,
): Promise<void> {
  const api = await playwright.request.newContext({ baseURL: 'http://localhost:5173' });
  await api.get('/api/v1/auth/session');
  const csrf =
    (await api.storageState()).cookies.find((c) => c.name === 'macronome.csrf')?.value ?? '';
  await api.post('/api/v1/auth/login', {
    headers: { 'x-csrf-token': csrf },
    data: { username: user, password: PASSWORD },
  });
  await page.context().addCookies((await api.storageState()).cookies);
}

test('seeded logged days render the rolling cards and the adherence heatmap', async ({
  page,
  playwright,
}) => {
  const userId = await seedUser('e2e_stats');
  await prisma.target.create({
    data: {
      userId,
      calorieMin: SNAPSHOT.cal_min,
      calorieMax: SNAPSHOT.cal_max,
      proteinGPerKg: 1.8,
      fatGPerKg: 0.8,
      effectiveFrom: new Date(`${YEAR}-01-01T00:00:00.000Z`),
    },
  });
  await seedSummaryDay(userId, `${YEAR}-02-10`, 1600); // OK
  await seedSummaryDay(userId, `${YEAR}-02-11`, 1700); // NOK
  await seedSummaryDay(userId, `${YEAR}-02-12`, 1580); // OK
  await seedSummaryDay(userId, `${YEAR}-02-13`, 1620); // OK

  await login(page, playwright, 'e2e_stats');
  await page.goto('/stats');

  // Section A — a rolling card and its kcal value (4 days within every window → 1625).
  await expect(page.getByText('7 jours', { exact: true })).toBeVisible();
  await expect(page.getByText('1625').first()).toBeVisible();
  // Section B — the adherence heatmap SVG.
  await expect(page.getByRole('img', { name: "Calendrier d'adhérence" })).toBeVisible();
});

test('a user with no logged days sees the empty state', async ({ page, playwright }) => {
  await seedUser('e2e_stats_empty');
  await login(page, playwright, 'e2e_stats_empty');
  await page.goto('/stats');

  await expect(
    page.getByText('Aucun jour enregistré. Saisis des repas pour voir tes stats.'),
  ).toBeVisible();
});
