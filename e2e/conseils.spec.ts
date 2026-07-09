import { expect, test, type Page, type PlaywrightWorkerArgs } from '@playwright/test';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

// e2e for the Conseils page (B-202): open via the 💡 lightbulb → generate → the archived advice
// appears → delete → it disappears. The AI provider call is not exercised end-to-end; the browser→API
// advice calls are stubbed at the Playwright layer (real generation/persistence is covered by the API
// integration tests). The user's settings are seeded with the advice task configured so the button
// shows. Auth has no UI — seed the user, log in via the proxied API, inject the cookies.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();
const PASSWORD = 'correct-horse-battery';

const SETTINGS = {
  ai: {
    provider: 'openai_compatible',
    base_url: 'https://ai.example.com/v1',
    api_key: 'k',
    tasks: {
      dish_photo_macros: { model: null, prompt: 'p' },
      meal_suggestions: { model: null, prompt: 'p' },
      advice: { model: 'coach-x', prompt: 'Give supportive advice.' },
    },
  },
};

async function seedUser(username: string): Promise<string> {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const user = await prisma.appUser.upsert({
    where: { username },
    update: { passwordHash, settings: SETTINGS },
    create: {
      username,
      passwordHash,
      sex: 'male',
      birthdate: new Date('1986-01-01'),
      heightCm: 180,
      settings: SETTINGS,
    },
  });
  await prisma.advice.deleteMany({ where: { userId: user.id } });
  return user.id;
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

/** Stub the browser→API advice calls with an in-memory archive (POST prepends, GET lists, DELETE
 *  removes). The real POST would call the configured provider — not available in e2e. */
async function stubAdvice(page: Page): Promise<void> {
  let archive: Record<string, unknown>[] = [];
  await page.route('**/api/v1/ai/advice', async (route) => {
    if (route.request().method() === 'POST') {
      const a = {
        id: 'e2e-advice-1',
        created_at: new Date().toISOString(),
        model: 'coach-x',
        content: '## Bilan e2e\n\n- Belle régularité, continue.',
        snapshot: {},
      };
      archive = [a, ...archive];
      await route.fulfill({ status: 201, json: { data: a } });
    } else {
      await route.fulfill({ status: 200, json: { data: archive } });
    }
  });
  await page.route('**/api/v1/ai/advice/*', async (route) => {
    const id = route.request().url().split('/').pop();
    archive = archive.filter((a) => a.id !== id);
    await route.fulfill({ status: 204, body: '' });
  });
}

test('open via the lightbulb → generate → archived → delete', async ({ page, playwright }) => {
  await seedUser('e2e_conseils');
  await login(page, playwright, 'e2e_conseils');
  await stubAdvice(page);

  await page.goto('/');
  await page.getByRole('link', { name: 'Conseils' }).click();
  await expect(page).toHaveURL(/\/conseils$/);

  // Generate → the archived Markdown reply appears (rendered heading + list).
  await page.getByRole('button', { name: 'Générer des conseils IA' }).click();
  await expect(page.getByRole('heading', { name: 'Bilan e2e' })).toBeVisible();
  await expect(page.getByText('Belle régularité, continue.')).toBeVisible();

  // Delete → it disappears.
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('heading', { name: 'Bilan e2e' })).toHaveCount(0);
});
