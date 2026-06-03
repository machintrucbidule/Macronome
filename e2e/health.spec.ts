import { expect, test } from '@playwright/test';

// Proves the full round-trip: browser → Vite proxy → API → Postgres → render.
test('health round-trip renders the connected state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('health-ok')).toBeVisible();
});
