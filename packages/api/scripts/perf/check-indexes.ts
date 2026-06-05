import { prisma } from '../../src/data/prisma.js';
import { INDEX_CHECKS } from './config.js';

// Verifies the contract indexes (spec/schema/indexes.md) exist on the live DB. Matched on
// pg_indexes.indexdef by table + covered columns (+ gin for trigram), not by name — so the
// historical `idx_day_log_owner_date` vs spec `idx_daylog_user_date` naming difference does
// not count as a miss. Returns true when every checked index is present.

interface PgIndexRow {
  tablename: string;
  indexname: string;
  indexdef: string;
}

function indexFor(
  candidates: PgIndexRow[],
  columns: string[],
  gin: boolean,
): PgIndexRow | undefined {
  return candidates.find((r) => {
    const def = r.indexdef.toLowerCase();
    const hasCols = columns.every((col) => def.includes(col));
    return hasCols && (gin ? def.includes('using gin') : true);
  });
}

export async function checkIndexes(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<PgIndexRow[]>(
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const byTable = new Map<string, PgIndexRow[]>();
  for (const r of rows) {
    const list = byTable.get(r.tablename);
    if (list) list.push(r);
    else byTable.set(r.tablename, [r]);
  }
  let allOk = true;
  const report = INDEX_CHECKS.map((c) => {
    const match = indexFor(byTable.get(c.table) ?? [], c.columns, c.gin ?? false);
    if (!match) allOk = false;
    return {
      check: c.label,
      'table(columns)': `${c.table}(${c.columns.join(', ')})`,
      index: match?.indexname ?? '— MISSING —',
      ok: Boolean(match),
    };
  });
  console.log('\n=== Contract index verification (spec/schema/indexes.md) ===');
  console.table(report);
  console.log(allOk ? '✓ All checked contract indexes present.' : '✗ Missing contract index(es).');
  return allOk;
}
