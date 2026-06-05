import { prisma } from '../src/data/prisma.js';
import { SIZES } from './perf/config.js';
import { seedLarge } from './perf/seed-large.js';
import { runMeasurements } from './perf/measure.js';
import { runExplain } from './perf/explain.js';
import { checkIndexes } from './perf/check-indexes.js';
import { cleanupPerfUser } from './perf/cleanup.js';

// M9d perf check (docs/dev-plan/M9-polish.md §M9d). On-demand only — NOT a CI gate.
// Seeds a large synthetic dataset → measures Stats + Foods search → EXPLAINs the hot
// queries → verifies the contract indexes → tears the data down. Run against the test DB:
//   npm run db:dev && npm run prisma:deploy -w @macronome/api
//   npm run perf:check -w @macronome/api [-- <years>]

async function main(): Promise<void> {
  const years = Number(process.argv[2]) || SIZES.years;
  console.log(`Seeding ~${years} year(s) of logs + ${SIZES.foods} foods…`);
  const { userId, year, counts } = await seedLarge(years);
  console.log(
    `Seeded: ${counts.foods} foods, ${counts.days} days, ${counts.meals} meals, ${counts.entries} entries.`,
  );
  await runMeasurements(userId, year);
  await runExplain(userId, year);
  await checkIndexes();
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupPerfUser();
    await prisma.$disconnect();
  });
