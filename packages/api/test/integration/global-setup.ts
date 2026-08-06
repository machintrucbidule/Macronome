import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFoodRefCatalog } from '../../src/services/ciqual-seed.js';

// Bring the test DB to the current schema before the suite runs (testing.md §2).
// Requires the compose.test.yml Postgres up: `npm run db:dev`.
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export default async function setup(): Promise<void> {
  execSync('npx prisma migrate deploy', { cwd: apiDir, stdio: 'inherit' });
  // The Ciqual reference catalog is seeded at boot in production (B-289), so the suite runs
  // against a populated one too. Idempotent: a second run is a no-op.
  const seeded = await seedFoodRefCatalog();
  console.log(`food_ref: ${seeded.count} entries (${seeded.dataset})`);
}
