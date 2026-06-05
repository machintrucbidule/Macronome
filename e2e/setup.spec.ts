import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

// e2e for M8 (First-run): a fresh install with no account → AppGate forces the setup
// wizard → the two-step wizard creates the single owner, opens the session, lands on the
// home screen, and the user can add their first food. Runs in the isolated `first-run`
// Playwright project (before the other DB-backed specs) so the zero-user precondition
// holds — see playwright.config.ts.
process.loadEnvFile('packages/api/.env');
const prisma = new PrismaClient();

const USER = 'e2e_owner';
const PASSWORD = 'correct-horse-battery';
const FOOD_NAME = `E2E First ${Date.now()}`;

test.beforeAll(async () => {
  // Zero-user precondition: the setup endpoint is gated to an empty app_user table.
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "app_user" CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "session"');
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('fresh install → wizard creates the owner → land logged-in → add first food', async ({
  page,
}) => {
  // Any route redirects to the wizard while no account exists.
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);

  // Step 1 — credentials.
  await page.getByLabel('Identifiant').fill(USER);
  await page.getByLabel('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Continuer' }).click();

  // Step 2 — metabolic profile.
  await page.getByLabel('Sexe').selectOption('male');
  await page.getByLabel('Date de naissance').fill('1990-01-01');
  await page.getByLabel('Taille').fill('180');
  await page.getByRole('button', { name: 'Créer le compte' }).click();

  // Lands logged-in on the home (Repas) screen, no longer on /setup.
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Aliments' })).toBeVisible();

  // Empty screens are navigable without a crash.
  await page.goto('/weight');
  await expect(page.getByRole('link', { name: 'Poids' })).toBeVisible();
  await page.goto('/stats');
  await expect(page.getByRole('link', { name: 'Stats' })).toBeVisible();

  // Can add the first food from an empty Aliments screen.
  await page.goto('/foods');
  await page.getByRole('button', { name: '+ Ajouter un aliment' }).click();
  await page.getByPlaceholder('Blancs de poulet').fill(FOOD_NAME);
  await page.getByLabel('Calories /100g').fill('292');
  await page.getByLabel('Lipides /100g').fill('30');
  await page.getByLabel('Glucides /100g').fill('3');
  await page.getByLabel('Protéines /100g').fill('2.4');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(FOOD_NAME)).toBeVisible();
});
