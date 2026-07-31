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
  // Days is the 3rd cell: B-225 inserted the 📋 interval-days recap button in its own cell
  // between the date range and the day count.
  await expect(period.locator('td').nth(2)).toHaveText('7');

  // Editing the second weigh-in's date to +14 re-derives the period (now 14 days).
  await period.click();
  await page.getByLabel('Date').fill('2026-02-24');
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.locator('tr[data-period="2026-02-17"]')).toHaveCount(0);
  const rederived = page.locator('tr[data-period="2026-02-24"]');
  await expect(rederived).toBeVisible();
  await expect(rederived.locator('td').nth(2)).toHaveText('14');
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

test('the "Ajouter une pesée" deep link opens the add modal once; Cancel keeps it closed (B-183)', async ({
  page,
  playwright,
}) => {
  const user = await prisma.appUser.findUniqueOrThrow({ where: { username: USER } });
  await prisma.weightEntry.deleteMany({ where: { userId: user.id } });
  await login(page, playwright);

  // The taskbar-shortcut deep link opens the add modal and the ?action=add param is consumed.
  await page.goto('/weight?action=add');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Date')).toBeVisible(); // it is the add/edit modal (has a date)
  await expect(page).toHaveURL(/\/weight$/); // the param was stripped (no F5/back re-open)

  // Cancel closes it — and it must NOT instantly re-open (the reported bug).
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toBeHidden();
  await page.waitForTimeout(500);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

/** ISO date n days before today (UTC) — the server's open-interval "today" is UTC. */
function isoDaysAgoUtc(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

test('the open interval leads the table and its reduced modal persists a note (B-176)', async ({
  page,
  playwright,
}) => {
  // Reset this user's weight + logs + settings, then seed a weigh-in 3 days old and a logged day
  // since → the open interval (last weigh-in → today) is triggered.
  const user = await prisma.appUser.findUniqueOrThrow({ where: { username: USER } });
  await prisma.dayLog.deleteMany({ where: { userId: user.id } });
  await prisma.weightEntry.deleteMany({ where: { userId: user.id } });
  await prisma.appUser.update({ where: { id: user.id }, data: { settings: {} } });
  await prisma.weightEntry.create({
    data: { userId: user.id, date: new Date(isoDaysAgoUtc(3)), weightKg: 80, dietFlag: 'in_diet' },
  });
  await prisma.dayLog.create({
    data: {
      userId: user.id,
      date: new Date(isoDaysAgoUtc(1)),
      kind: 'summary',
      summaryKcal: 2000,
      activityLevel: 'sedentary',
      targetSnapshot: {},
    },
  });

  await login(page, playwright);
  await page.goto('/weight');

  // The open interval row leads the table (end = today), shows the average intake, and dashes the
  // end-weight figures (no closing weight yet).
  const openRow = page.locator(`tr[data-period="${isoDaysAgoUtc(0)}"]`);
  await expect(openRow).toBeVisible();
  await expect(openRow).toContainText('Aujourd');
  await expect(openRow).toContainText('2000'); // avg intake

  // Clicking it opens the reduced "open period" modal: note + régime only (no date/weight input).
  await openRow.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Intervalle ouvert');
  await expect(dialog).toContainText('Régime de la période'); // régime is editable
  await expect(dialog.locator('input[type="date"]')).toHaveCount(0); // no measurement fields

  // Save a note → it persists onto the open interval (survives a reload).
  await dialog.getByLabel('Note').fill('felt strong');
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/v1/settings') && r.request().method() === 'PATCH',
    ),
    dialog.getByRole('button', { name: 'Enregistrer' }).click(),
  ]);
  await page.reload();
  await expect(page.locator(`tr[data-period="${isoDaysAgoUtc(0)}"]`)).toContainText('felt strong');
});
