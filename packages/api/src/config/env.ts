import { z } from 'zod';

// Zod-validated process environment. The app refuses to start on invalid config
// (12-factor; secrets come from env only — docs/architecture/ops.md §4).
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  SESSION_SECRET: z.string().min(16),
  TRUSTED_PROXY: z.string().min(1).default('loopback'),
  PUBLIC_BASE_URL: z.string().url(),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Absolute path to the built SPA (packages/web/dist) the API serves in prod.
  // Set in the Docker image; absent in dev where Vite serves the SPA (ADR-0001).
  WEB_DIST: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}

export const env = loadEnv();
