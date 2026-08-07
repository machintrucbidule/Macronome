import { defineConfig } from '@playwright/test';

// e2e drives the SPA against the running stack (testing.md §3). webServer boots the
// dev API + Vite (which proxies /api → API). The compose.test.yml Postgres must be
// up and migrated first (npm run db:dev && npm run migrate).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Flakiness fix, measured not guessed. The suite failed roughly one local run in three, on a
  // DIFFERENT test each time, always a `toBeVisible` expiring — never a wrong value. Isolation is
  // not the cause: every spec already seeds its own user and its cleanups are scoped to it. The
  // cause is over-subscription. Playwright defaults to cores/2 workers, which on a 24-core dev
  // box is 12 browser contexts against ONE Vite **dev** server that transforms routes on demand
  // and ONE Postgres; a lazily-loaded route's first paint can then exceed the 5s default budget.
  //
  // So: cap the local worker count, and give assertions a budget that fits a cold dev-server
  // route. Neither hides a real failure — a genuinely broken assertion still fails, 10s later
  // instead of 5. (Raising `retries` locally WOULD hide one, which is why it stays at 0.)
  // CI is left on Playwright's own default: its runners have ~4 cores, so it never over-subscribed
  // in the first place — that is why CI has been green while local runs were not.
  workers: process.env.CI ? undefined : 4,
  expect: { timeout: 10_000 },
  // `retain-on-failure`, not `on-first-retry`: the retry is not a faithful replay. Every spec
  // seeds fixture rows named once per worker process, so a test that failed halfway leaves its
  // rows behind and the retry meets a different database than the first attempt did — the foods
  // batch spec's retry fails on the row COUNT, several steps before the assertion that actually
  // broke. Tracing the first attempt is the only way to see the failure that matters.
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
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
