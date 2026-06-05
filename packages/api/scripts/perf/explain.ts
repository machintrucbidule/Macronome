import { prisma } from '../../src/data/prisma.js';

// Prints query plans for the hot reads so we can confirm the contract indexes are used:
// the trigram GIN index for accent-folded food search, and the (user_id, date) index for
// the day_log range scan. The full-history readAll scan is shown for transparency — over
// one user's rows the planner may legitimately pick a seq scan (low selectivity).

async function printPlan(label: string, sql: string): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Record<string, string>[]>(sql);
  console.log(`\n--- ${label} ---`);
  console.log(rows.map((r) => r['QUERY PLAN']).join('\n'));
}

export async function runExplain(userId: string, year: number): Promise<void> {
  console.log('\n=== EXPLAIN ANALYZE — index usage ===');
  await printPlan(
    "food trigram search (LIKE '%creme%')",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM food
     WHERE owner_id = '${userId}' AND archived_at IS NULL
       AND normalized_name LIKE '%creme%'
     ORDER BY name ASC, id ASC LIMIT 51`,
  );
  await printPlan(
    `day_log year range (${year})`,
    `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM day_log
     WHERE user_id = '${userId}' AND date >= '${year}-01-01' AND date <= '${year}-12-31'
     ORDER BY date ASC`,
  );
  await printPlan(
    'day_log full history (readAll)',
    `EXPLAIN (ANALYZE) SELECT * FROM day_log
     WHERE user_id = '${userId}' ORDER BY date ASC`,
  );
}
