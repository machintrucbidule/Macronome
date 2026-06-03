# Security posture (internet-facing from v1)

Macronome is reachable from the internet in v1. The threat model is modest (one
self-hosted user, minimal PII) but real (credential attacks, CSRF, tenant leaks).
Choices favour boring, proven mechanisms over novelty.

---

## 1. Authentication & session

- **Local accounts only**, no public sign-up, no OAuth (contract §7). The v1 user is
  bootstrapped (see `ops.md` §7).
- **Server-side opaque sessions**, stored in PostgreSQL: `express-session` +
  `connect-pg-simple`. The cookie carries only an opaque session id; no claims, no
  user data. "Stay signed in" = a long-lived session row with a long/sliding expiry;
  not selecting it = a short session.
- **Revocation is instant**: deleting the session row logs the device out. No
  refresh-token rotation, no token blacklist (the reasons JWTs were avoided).
- Endpoints exactly as `spec/api/00-conventions.md`: `POST /auth/login`,
  `/auth/logout`, `GET /auth/session`, `POST /auth/password`.

## 2. Password handling

- **argon2id** (the `argon2` package), sensible memory/time cost; tuned once at
  setup. (bcrypt is the contract's fallback; argon2id is the v1 choice.)
- `password_hash` and the password-change flow are **never logged**.
- Password change is a dedicated authenticated flow (current + new), not a plain
  field on a profile PATCH.

## 3. Login hardening (rate-limit / lockout)

- Failed attempts tracked per `(username, client_ip)`; after a threshold, the
  account/IP is locked with a backoff window.
- Responses match the contract's **non-enumerating** rule:
  - wrong credentials → **401** `{error:{code:'invalid_credentials'}}` — identical
    whether or not the username exists.
  - locked → **429** `{error:{code:'locked_out', retry_after_s}}`.
- The client renders these as the lockout/countdown and generic-error states already
  designed (`design/components/states.md`).
- **Real client IP**: rate-limit keys on the forwarded client IP, trusted **only**
  from the configured proxy (`TRUSTED_PROXY`). Without this, an attacker spoofs
  `X-Forwarded-For` to dodge lockout. This is the one frontal-related security item
  and it is generic (works behind any reverse proxy / tunnel).

## 4. Cookies & CSRF

- Session cookie: **HttpOnly, Secure (prod), SameSite=Lax**, scoped path. `Secure`
  is env-gated (`COOKIE_SECURE`) so local HTTP dev still works.
- **CSRF protection on all state-changing requests** (POST/PATCH/DELETE): a
  double-submit token (a non-HttpOnly CSRF cookie + a matching header the SPA sends).
  SameSite=Lax is the first line; the token is defence-in-depth. The web `api/client.ts`
  attaches the header automatically.

## 5. Input-validation boundary

- **One boundary, one tool: Zod at every controller.** Request bodies/params/query
  are parsed against the `shared/dto` schema before any service runs; failure →
  **422** with per-field `details` (contract error shape). No unvalidated input
  reaches a service or Prisma.
- Domain blocks (incoherent leftover, occupied weigh-in date) are **409** with a
  mappable `code`; the carb-ceiling ≤ 0 case is **not** an error (200 + warning).

## 6. Tenant isolation (every data path)

- Enforced in the **repository layer**: every repository method takes the
  authenticated `userId` and scopes the query; there is no unscoped data method to
  call by mistake. A `tenant` middleware puts the authenticated user id in the
  request context; services pass it down.
- Cross-tenant access returns **404, not 403** (no existence leak), per contract.
- Shared-catalog rows (`food.visibility = 'shared'`) are readable by any user but
  writable only by `owner_id`; the name-resolution shadowing rule is implemented
  though inert with one user.
- Lint import-boundaries prevent controllers from reaching Prisma directly, so
  scoping can't be bypassed by accident (`modularity.md` §4).

## 7. Secrets handling

- All secrets via env (`ops.md` §4); `.env` gitignored; `.env.example` keys-only.
- `SESSION_SECRET` long and random. The reserved `LLM_ENDPOINT_KEY` is stored,
  never logged, and sent only to the configured endpoint **if/when** the advisor is
  built (it is inert in v1).
- Logging: structured logs scrub credentials, session ids, and the password/LLM
  fields. Error responses never include stack traces in prod.

## 8. Dependency hygiene

- Committed lockfile (`package-lock.json`); `npm audit` in CI (report; fail on
  high/critical for production deps).
- Minimal dependency surface (the anti-over-engineering stance helps here);
  Dependabot/Renovate optional, operator's call.
- Pin the Node and PostgreSQL major versions in the images.

## 9. Other

- **Minimal PII**: only what the user enters (body metrics, food logs). No
  third-party analytics, no external calls in v1 (the advisor endpoint is off).
- Security headers (HSTS, X-Content-Type-Options, Referrer-Policy, a conservative
  CSP for the SPA) set at the proxy; CSP details in `appendices/config-docker.md`.
- The reserved `POST /advisor/query` returns **501** until explicitly built; it
  cannot leak data while inert.
