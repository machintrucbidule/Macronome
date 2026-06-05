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
  // The first-run spec needs a zero-user database (the setup endpoint is gated to it). It
  // truncates app_user, so it must not run concurrently with the other DB-backed specs:
  // it runs alone in the `first-run` project, which the `app` project depends on, giving a
  // serial phase before the rest start (each of which seeds its own user).
  projects: [
    { name: 'first-run', testMatch: /setup\.spec\.ts$/ },
    { name: 'app', testIgnore: /setup\.spec\.ts$/, dependencies: ['first-run'] },
  ],
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
