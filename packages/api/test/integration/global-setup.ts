import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Bring the test DB to the current schema before the suite runs (testing.md §2).
// Requires the compose.test.yml Postgres up: `npm run db:dev`.
const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export default function setup(): void {
  execSync('npx prisma migrate deploy', { cwd: apiDir, stdio: 'inherit' });
}
