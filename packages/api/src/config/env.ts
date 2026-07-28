import { z } from 'zod';

// Zod-validated process environment. The app refuses to start on invalid config
// (12-factor; secrets come from env only — docs/architecture/ops.md §4).
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  // Optional: when unset, a secret is auto-generated and persisted on first boot
  // (config/session-secret.ts) to keep deployment zero-config (ADR-0001).
  SESSION_SECRET: z.string().min(16).optional(),
  // Which peers Express believes for `X-Forwarded-*` (real client IP + `req.secure`).
  // Default trusts loopback + all private/container ranges (`uniquelocal`: 10/8, 172.16/12,
  // 192.168/16, fc00::/7) so a sidecar reverse proxy / tunnel (e.g. cloudflared on the Docker
  // bridge) is trusted out of the box — required for `COOKIE_SECURE=true` and for keying login
  // rate-limiting on the real client IP (security.md §3). Trade-off: since the app port is
  // published, a same-LAN peer could forge these headers; tighten to the exact proxy CIDR if
  // that matters. Override with any Express `trust proxy` value (a CIDR/list, a preset, or a
  // hop count). Set to `loopback` to trust only same-host proxies.
  TRUSTED_PROXY: z.string().min(1).default('loopback, uniquelocal'),
  // Optional explicit public origin (scheme+host) for the Google Drive OAuth callback (B-217).
  // When set, the server builds the redirect_uri + validates the HTTPS gate from it directly —
  // no dependence on trust-proxy header derivation. Empty string ⇒ treated as unset. This is
  // origin-only and OAuth-scoped (distinct from the ADR-0001-removed PUBLIC_BASE_URL); zero-config
  // is preserved when absent (ADR-0004).
  PUBLIC_ORIGIN: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  // How the `Secure` attribute of the session and CSRF cookies is decided (B-232, security.md §4):
  //   auto  (default) — Secure iff the request is seen as HTTPS (`req.secure`, trust-proxy derived).
  //                     Hardening turns itself on behind a trusted HTTPS proxy; plain HTTP still
  //                     works. This is the only mode that cannot refuse to emit the cookie.
  //   true            — force Secure. Locks the operator out when the request is NOT seen as HTTPS:
  //                     express-session then emits no cookie at all and login fails as a misleading
  //                     403 CSRF (B-222). A throttled warning fires when that combination is seen.
  //   false           — never Secure. Kept deliberately as the operator's unblocking lever.
  // Stays a string (not a boolean) because the three states are not a flag.
  COOKIE_SECURE: z.enum(['auto', 'true', 'false']).default('auto'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Absolute path to the built SPA (packages/web/dist) the API serves in prod.
  // Set in the Docker image; absent in dev where Vite serves the SPA (ADR-0001).
  WEB_DIST: z.string().optional(),
  // App version, surfaced at /api/v1/health. Baked into the image at build from the git tag
  // (the single source of truth — ADR-0002); 'dev' when running outside the image.
  APP_VERSION: z.string().default('dev'),
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
