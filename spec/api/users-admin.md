# API — user administration (Utilisateurs)

See `00-conventions.md`. **Admin-only** (an active session whose account has
`is_admin = true` is required; the role is re-read from the database on every
request, so a demotion takes effect immediately). Base path `/api/v1/users`.
Non-admin → **403** `{error:{code:'forbidden'}}` (a **role** gate — unlike
user-owned resources, where cross-tenant access is 404, this resource
legitimately lists other accounts; the endpoint's existence is not a secret).
Unauthenticated → 401. CSRF applies to the state-changing verbs (global
middleware).

Account **metadata only** is ever exposed: never the password hash, the
`settings` blob, or the metabolic profile. An admin manages accounts, not
their data (owner decision, B-192).

`AdminUser = {id, username, is_admin, created_at, last_login_at|null,
last_seen_at|null}` — instants ISO-8601 UTC (`last_*` per B-190).
`last_seen_at` is refreshed at most **once per 5 minutes** per user
(`00-conventions.md` §7), so a listed stamp can lag real activity by up to that
window — deliberate, to avoid a database write on every request (B-239).

## Endpoints

- `GET /users` — → 200 `{data: AdminUser[]}`, sorted by `created_at` ascending
  (owner first). No pagination (self-hosted, a handful of accounts).
- `PATCH /users/:id` — body `{is_admin: boolean}` (anything else → 422).
  Promote/demote. → 200 `{data: AdminUser}` (the updated row; idempotent
  no-op returns 200 too).
  - Unknown id → **404** `{error:{code:'not_found'}}`.
  - Target is the caller → **409** `{error:{code:'own_account'}}` (an admin
    never changes their own role; another admin must — owner decision).
  - The change would demote the only remaining admin → **409**
    `{error:{code:'last_admin'}}` (never fewer than 1 admin). With
    `own_account` enforced this is unreachable through normal HTTP flow
    (the caller is always another admin); it remains as a race-safety net.
- `DELETE /users/:id` — → 204. Deletes the account **and all its data** in a
  single transaction (the IMP-1 wipe order, structure included), then the
  `app_user` row, and revokes **every session** of the deleted user (their
  next request is 401). Same 404 / 409 `own_account` / 409 `last_admin`
  errors as PATCH. Pending password-reset tokens for the account cascade away.

## Token endpoints (B-193 invitations / B-194 password resets)

Single-use links backed by `account_token` (`spec/schema/tables-catalog.md`):
sha256-hashed, 7-day expiry, revocable. The **raw token is returned once** at
creation; the client builds the shareable URL (`/invite#<token>` /
`/reset#<token>` — fragment, so it never reaches server logs). The public
consumption endpoints live in auth (`00-conventions.md` §7).

- `POST /users/invites` — body `{is_admin: boolean}` (role granted at
  creation). → 201 `{data:{id, token, expires_at, is_admin}}` (`token` = raw,
  shown once, never retrievable again).
- `GET /users/tokens` — → 200 `{data: [{id, kind, is_admin, username|null,
created_at, expires_at}]}` — every pending link (invites + resets), oldest
  first; expired rows are purged before listing. `username` is the reset
  target (null for invites). The token itself is never listed.
- `DELETE /users/tokens/:id` — revoke. → 204; unknown id → 404.
- `POST /users/:id/reset-token` — generate a password-reset link for the
  account. → 201 `{data:{id, token, expires_at}}`. **Replaces** the account's
  pending reset token, if any (at most one active per user — owner decision).
  Errors: 404 unknown id; **409 `own_account`** (an admin resets their own
  password on Mon compte, not here).
