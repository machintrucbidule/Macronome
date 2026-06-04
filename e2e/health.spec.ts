import { expect, test } from '@playwright/test';

// Proves the full round-trip: browser → Vite proxy → API → Postgres → render.
test('health round-trip renders the connected state', async ({ page }) => {
  // Repas is the home route (M3b); the M0 health round-trip lives at /health.
  await page.goto('/health');
  await expect(page.getByTestId('health-ok')).toBeVisible();
});
