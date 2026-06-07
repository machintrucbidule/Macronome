import { prisma } from './prisma.js';

// Data layer for GET /api/v1/about (mirrors data/health.ts). PostgreSQL banner + on-disk size
// via one raw query; `pg_database_size` is cast to float8 so it returns a plain number (no BigInt
// to serialise). `STARTED_AT` is captured once at import (process boot) for the uptime display.

/** Process boot instant (ISO-8601 UTC), evaluated once when this module is first loaded. */
export const STARTED_AT: string = new Date().toISOString();

export interface DbInfo {
  server_version: string;
  size_bytes: number;
}

/** PostgreSQL version banner + current database size, in one round-trip. */
export async function dbInfo(): Promise<DbInfo> {
  const rows = await prisma.$queryRaw<{ version: string; size: number }[]>`
    SELECT version() AS version, pg_database_size(current_database())::float8 AS size
  `;
  const row = rows[0];
  return { server_version: row?.version ?? 'unknown', size_bytes: row?.size ?? 0 };
}
