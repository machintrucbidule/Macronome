import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Integration tests: real Express app against the compose.test.yml Postgres.
// Run serially (shared DB) and migrate once via the global setup. The test DB
// credentials are non-secret (local test container), so they live here.
const TEST_ENV = {
  DATABASE_URL: 'postgresql://macronome:test@localhost:5433/macronome_test',
  PORT: '3000',
  SESSION_SECRET: 'integration-test-session-secret-0123456789',
  TRUSTED_PROXY: 'loopback',
  PUBLIC_BASE_URL: 'http://localhost:5173',
  // The production default, so the per-request derivation is what the suite exercises (B-232).
  COOKIE_SECURE: 'auto',
  // Keep the authentication black box (B-231) inside the package: without this it would try to
  // create /data, which is not writable on the CI runner nor sane on a Windows dev box.
  MACRONOME_DATA_DIR: fileURLToPath(new URL('./test/.tmp-data', import.meta.url)),
  NODE_ENV: 'test',
};

// Make the same env visible to the global setup (runs in the main process).
Object.assign(process.env, TEST_ENV);

export default defineConfig({
  resolve: {
    alias: {
      '@macronome/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    env: TEST_ENV,
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
