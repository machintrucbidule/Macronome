import { defineConfig } from '@playwright/test';

// e2e drives the SPA against the running stack (testing.md §3). webServer boots the
// dev API + Vite (which proxies /api → API). The compose.test.yml Postgres must be
// up and migrated first (npm run db:dev && npm run migrate).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: [
    {
      command: 'npm run dev:api',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
