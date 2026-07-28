// Is this error "the database is unreachable" rather than a bug? (B-231 hardening.)
//
// A lost connection is transient and retryable; reporting it as a generic 500 makes the client
// say "technical problem", which sends the operator hunting for a misconfiguration that does not
// exist. Recognising it lets the API answer 503 `database_unavailable` and the login screen say
// "wait and retry, change nothing" (spec/api/00-conventions.md).
//
// Pure and structural: it inspects only `name`/`code`/`message`, so it needs neither Prisma nor pg
// imported here and is unit-testable against literal error shapes from both drivers.

// Prisma connectivity/initialisation codes (P1xxx are connection-level; P2024 is pool timeout).
const PRISMA_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

// Node socket errnos plus Postgres SQLSTATE classes 08 (connection exception) and 57P0x
// (admin/crash shutdown, cannot_connect_now — what a server in recovery answers).
const DRIVER_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08P01',
  '53300',
  '57P01',
  '57P02',
  '57P03',
]);

const PRISMA_INIT_ERROR = 'PrismaClientInitializationError';

// pg reports a pool/socket teardown with no code at all, only this message.
const CONNECTION_TERMINATED = 'connection terminated';

export function isDatabaseUnavailable(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { name, code, message } = err as { name?: unknown; code?: unknown; message?: unknown };

  if (name === PRISMA_INIT_ERROR) return true;
  if (typeof code === 'string' && (PRISMA_CODES.has(code) || DRIVER_CODES.has(code))) return true;
  return typeof message === 'string' && message.toLowerCase().includes(CONNECTION_TERMINATED);
}
