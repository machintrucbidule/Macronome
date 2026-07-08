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
  errors as PATCH.
