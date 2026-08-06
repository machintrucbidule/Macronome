# Security posture (internet-facing from v1)

Macronome is reachable from the internet in v1. The threat model is modest (one
self-hosted user, minimal PII) but real (credential attacks, CSRF, tenant leaks).
Choices favour boring, proven mechanisms over novelty.

---

## 1. Authentication & session

- **Local accounts only**, no open/public sign-up, no OAuth (contract §7). The single
  owner account is created by a one-shot, zero-user-gated first-run setup wizard
  (disabled once the owner exists), with the `create-user` CLI as an admin fallback —
  bootstrap details in `ops.md` §7.
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
  from the peers named by `TRUSTED_PROXY`. Without this, an attacker spoofs
  `X-Forwarded-For` to dodge lockout. This is the one frontal-related security item
  and it is generic (works behind any reverse proxy / tunnel).
  - The **default** is `loopback, uniquelocal` — it trusts loopback **and** the
    private/container ranges (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), so a
    Docker-sidecar proxy / tunnel is trusted out of the box (this is what makes the derived
    `Secure` cookie and real-client-IP keying work without extra config, and it also
    ungates the Drive OAuth HTTPS check — §4/ops.md §6c). **Trade-off:** since the app port
    is typically published on the host, a peer on the same LAN can reach it directly and
    would then be a trusted private-range peer able to forge `X-Forwarded-*` (spoof the
    client IP to dodge lockout, or claim HTTPS). Low risk for a single-user self-host;
    tighten by narrowing `TRUSTED_PROXY` to `loopback` (same-host proxy only) or to the
    proxy's exact CIDR when the port is exposed to an untrusted network.

## 4. Cookies & CSRF

- Session cookie: **HttpOnly, SameSite=Lax**, scoped path. `Secure` is **derived per
  request** from a three-state `COOKIE_SECURE` (B-232), applied identically to the session
  and CSRF cookies:
  - `auto` (**default**) — `Secure` when the request is seen as HTTPS (`req.secure`, i.e.
    trust-proxy derived from `X-Forwarded-Proto` per the `TRUSTED_PROXY` list above), else
    not. Hardening switches itself on behind a trusted HTTPS proxy, and local HTTP dev keeps
    working with no configuration.
  - `true` — force `Secure` unconditionally. **This can lock the operator out**: when the
    request is not seen as HTTPS, express-session _refuses to emit the cookie at all_ and
    every login fails as a misleading 403 CSRF (B-222). A throttled server warning fires
    whenever this combination is observed.
  - `false` — never `Secure`. Kept deliberately as the operator's unblocking lever.
- `PUBLIC_ORIGIN` deliberately does **not** force `Secure`, even when it is an https URL:
  express-session gates _emission_ on the request being seen as HTTPS, which a declared
  origin cannot influence — so honouring it there would recreate the B-222 lockout rather
  than prevent it.
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
- **Documented exception — global reference tables (B-289).** `food_ref` (the Ciqual
  catalog shipped inside the image) holds no user data: no `owner_id`, no per-user
  rows, nothing a user ever wrote. `food-ref.repo` is therefore **read-only and takes
  no `userId`** — there is no tenant to scope to, and adding a fake one would only
  hide that fact. The rule still binds everything else: any method of that repository
  that touches user data (the "do I already own a food with this name?" probe) takes
  `userId` like every other, and writes to `food_ref` come only from the boot seeder,
  never from a request. This exception is scoped to global reference data — it is not
  a licence to write an unscoped query anywhere else.
- Lint import-boundaries prevent controllers from reaching Prisma directly, so
  scoping can't be bypassed by accident (`modularity.md` §4).

## 7. Secrets handling

- All secrets via env (`ops.md` §4); `.env` gitignored; `.env.example` keys-only.
- `SESSION_SECRET` long and random. The reserved `LLM_ENDPOINT_KEY` is stored,
  never logged, and sent only to the configured endpoint **if/when** the advisor is
  built (it is inert in v1).
- Logging: structured logs scrub credentials, session ids, and the password/LLM
  fields. Error responses never include stack traces in prod.
- **Authentication black box** (`/data/auth_failures.jsonl`, B-231): one JSON line per failed
  authentication attempt, written to the app data volume so the evidence survives the
  container recreation that "fixing" such an outage requires. It records only the transport
  facts needed to name a cookie/proxy misconfiguration — `req.secure`, `X-Forwarded-Proto`,
  the TCP peer, Express's own trust-proxy verdict, the `COOKIE_SECURE`/`TRUSTED_PROXY`
  settings, whether a session was found, whether a `Set-Cookie` was emitted, the route,
  status and error code — plus the **names** of the cookies involved. It must never contain a
  cookie value, a session id, a username, or any password material, and it is bounded
  (500 records + one archived generation). The `ref` returned in the error envelope points at
  a record; the record contains nothing the operator could not already read from their own
  proxy configuration.

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
  CSP for the SPA) emitted by the **app** via `helmet`
  (`http/middleware/securityHeaders.ts`) — the app serves the SPA itself (ADR-0001),
  so headers are not delegated to a proxy. The operator's frontal only terminates TLS.
  Sole third-party CSP allowance: `img-src` also permits `https://*.chronodrive.com`
  (the food modal's product thumbnails, B-182 — public images loaded browser-side,
  not proxied in v1; owner-approved).
- The reserved `POST /advisor/query` returns **501** until explicitly built; it
  cannot leak data while inert.
