# API contract — conventions

REST, API-first; consumed by the web SPA today and the React Native app later.
Defines endpoints only (no server implementation). All payloads JSON.
Base path `/api/v1`. See `logic/*` for computation rules.

## Auth & session (§7)

- `POST /api/v1/auth/login` — body `{username, password, stay_signed_in}`.
  Sets an HTTP-only, Secure, SameSite cookie session; long-lived refresh when
  `stay_signed_in`. 200 `{user:{id,username,locale,theme,is_admin}}`.
  A successful login stamps `app_user.last_login_at` (and `last_seen_at`).
  - Failed credentials → **401** with a generic, non-enumerating body
    `{error:{code:'invalid_credentials'}}` (never reveal whether the user
    exists).
  - Rate-limit/lockout → **429** `{error:{code:'locked_out', retry_after_s}}`.
- `POST /api/v1/auth/logout` — 204; clears session.
- `GET /api/v1/auth/session` — 200 current user (same `{user}` shape as login)
  or 401.
- Every authenticated request refreshes `app_user.last_seen_at`, throttled to
  one write per **5 minutes** per user; the stamp is fire-and-forget (never
  blocks or fails the request). (B-190; window narrowed from one hour by B-239 —
  an hour-old stamp read as "frozen" on the Utilisateurs screen.)
- Password change is a dedicated secure flow (not a plain field):
  `POST /api/v1/auth/password` (current + new); never logged.
- First-run bootstrap (single owner account):
  - `GET /api/v1/auth/setup-state` — unauthenticated, non-enumerating; 200
    `{setup_required}` (whether _any_ user exists yet; never reveals _which_).
  - `POST /api/v1/auth/setup` — body `{username, password, sex, birthdate,
height_cm, locale?, theme?}`.
    Allowed **only while no user exists**; creates the single owner **as admin**
    (`is_admin = true`), seeds defaults, opens the session (stamping
    `last_login_at`/`last_seen_at` like a login). Once an owner exists → **409**
    `{error:{code:'setup_already_completed'}}` (creates nothing).
    `locale` / `theme` are **optional** (same literals as `GET/PATCH /settings`)
    and **initialise the new account's settings**, so the language and theme
    picked on the pre-auth bar survive first entry; omitted → the stored
    defaults (`fr` / `dark`) as before. (B-237)
- **No open/public sign-up.** Account creation is limited to the one-shot,
  zero-user-gated first-run setup above, plus **token-gated registration via
  admin-generated invitations** (B-193 — a deliberate, owner-approved carve-out
  of the earlier "no registration endpoint" rule): no _open_ registration
  endpoint is ever exposed. CSRF protection on all state-changing requests.
- Token flows (B-193/B-194; tokens are single-use, 7-day, admin-revocable —
  `users-admin.md`; the raw token travels in POST bodies only, never in a URL
  path/query, and is redacted from logs):
  - `POST /api/v1/auth/token-state` — body `{token}`; 200
    `{valid, kind?, is_admin?}` (non-enumerating probe for the invite/reset
    pages; `kind ∈ 'invite'|'password_reset'`).
  - `POST /api/v1/auth/register` — body `{token, username, password, sex,
birthdate, height_cm, locale?, theme?}` (the setup payload + token; the two
    optional appearance fields behave exactly as on `/auth/setup` — B-237).
    Creates the account with
    the invite's role, seeds defaults, consumes the token, opens the session →
    200 `{user}`. Errors: **409** `{error:{code:'token_invalid'}}` (invalid /
    expired / revoked / wrong-kind — one non-enumerating code) and **409**
    `{error:{code:'username_taken'}}` (does **not** consume the invite).
    Rate-limited like login.
  - `POST /api/v1/auth/reset-password` — body `{token, new_password}` (min 8).
    Sets the target account's password, consumes the token and **revokes all of
    that account's sessions** → 204. 409 `token_invalid`. Rate-limited.
- Admin account management (list / promote / demote / delete users, invitation
  and password-reset links) lives under `/api/v1/users` — see `users-admin.md`
  (B-192/B-193/B-194; admin-only, 403 for non-admins).

## Tenancy

Every endpoint operates on the authenticated user; the server scopes all
user-owned reads/writes by `user_id`. Cross-tenant access → 404 (not 403, to
avoid existence leaks).

## Error shape (consistent)

```json
{
  "error": {
    "code": "string_snake",
    "message": "human readable",
    "details": { "field": "reason" },
    "ref": "XXXX-XXXX"
  }
}
```

`ref` is **optional** and diagnostic only: a short code identifying the server-side
authentication black-box record for this failure (`ops.md` §4/§6b, B-231). It is emitted
**only** on failures of the authentication-attempt routes (`POST /auth/login`, `/auth/setup`,
`/auth/register`, `/auth/reset-password`, `/auth/password`) so the operator can quote it
instead of hunting logs. Clients must not parse or branch on it — it is opaque text to be
displayed and copied.

Validation failures → **422** with per-field `details`.
Domain blocks (e.g. leftover incoherent) → **409** with a `code` the client maps
to a warning (e.g. `leftover_exceeds_served`, `gross_below_tare`, `copy_source_empty`,
`nothing_to_undo` (B-261 — `POST /days/:date/undo` with no restore point for that date, or a
second undo after one already consumed it),
`weigh_in_date_occupied`, `target_date_occupied` — both carry `{existing_id}` —
and the admin guards `last_admin`, `own_account` — see `users-admin.md`, B-192).
Targets carb ceiling ≤ 0 is **not** an error — it returns 200 with a `warnings` array.
The macro-label parser (`POST /foods/parse-label`, PM-1/B-114) returns **422**
`{error:{code}}` for structurally-impossible input: `reconstituted_label`,
`no_reference`, `unparseable` (see `foods-recipes.md` + `logic/macro-label-parser.md`).

A lost database connection is **not** a bug and must not read as one: any request that fails
because the database is unreachable returns **503** `database_unavailable` instead of a generic
500, so the client can say "temporarily unavailable, retry" rather than "technical problem"
(B-231 hardening).

## Status codes

200 OK · 201 Created · 204 No Content · 400 malformed · 401 unauth ·
403 forbidden (rare) · 404 not found / cross-tenant · 409 domain conflict ·
422 validation · 429 rate-limited · 500 server · 503 database unavailable.

## List behaviour

- Pagination: `?limit=` (default 50, max 200) `&cursor=` (opaque, keyset on
  `(sort_key,id)`); responses include `{data:[...], next_cursor, total}`.
- **`offset`** (LD-1/B-303) — an alternative to `cursor`, for **jumping** rather than walking:
  `?offset=N` returns the page starting at row N of the same ordering. The two are **mutually
  exclusive**; sending both is a **422** (`validation_error`), because they would express two
  different start positions for one request. A cursor is a row id, so it can only ever say "the
  page after this row" — a client that drops its scrollbar into the middle of a 3 400-row catalogue
  cannot name the row it landed on, and had to walk every page to get there. `offset` is that
  client's entry point; `cursor` remains the cheaper way to continue sequentially. Ordering,
  `next_cursor` and `total` are identical either way: the page at `offset = k·limit` is exactly the
  page a cursor walk would reach after `k` steps.
- `total` is returned on **every** page, whichever of the two is used (B-303 kept this deliberately:
  with jumps, the first page to arrive is often not page 1, and a client that only learned the total
  from page 1 would size its scrollbar wrong until it caught up).
- **`total`** (B-278) is the number of rows matching the query's **filters** — search, rating,
  visibility, archived — and is therefore independent of `limit` and `cursor`: every page of the
  same query reports the same figure. It lets a client size its scrollbar to the whole result set
  instead of to the rows fetched so far, and show a meaningful count. Paginated resource lists
  only; the autocomplete search endpoints below do not carry it.
- Sorting: `?sort=field&dir=asc|desc` where allowed per resource.
- Filtering: documented per resource.
- **Autocomplete search** (`?q=`): diacritic-insensitive, matches
  `normalized_name` via `unaccent`+`pg_trgm`; returns ranked matches, default
  `limit=10`. Used by foods, recipes, and the combined food∪recipe log search.

## Bulk writes (BE-1)

One request that edits **several independent rows** of one resource (`PATCH /foods/bulk`,
`PATCH /recipes/bulk`). Distinct from the multi-id bodies that already existed — a reorder, a
leftover selection — which act on **one** parent row.

- **All or nothing, in one transaction.** There is deliberately **no partial-success convention**:
  the response is a plain count (`{updated: n}`), never a per-row error list. A caller that has to
  reconcile "37 of 40 worked" cannot show anything useful, and the undo below could not restore a
  half-applied batch.
- **Every id is checked against the authenticated user.** The ids come from the client and are
  never trusted. If any id is not the user's — or is not a row of that resource — the request is a
  **404** and **nothing is written** (same rule as `PATCH /meals/:mealId/entries/order`).
- **`ids`**: at least 1, at most **5 000** (`validation_error`, 422, above it). The ceiling sits far
  above any personal catalogue; it exists so a malformed client cannot hand the server an unbounded
  list, not to limit a real selection.
- **The patch must change something**: a body whose every field is absent → **422**
  `{details:{patch:'empty_patch'}}`. An absent field means _leave unchanged_; a field set to `null`,
  where the column is nullable, means _clear_ — the same semantics as the single-row `PATCH`.
- **Undo** (`POST /<resource>/bulk/undo`, no body). Restores the values the last bulk write
  overwrote → `{restored: n}`. The snapshot is held **server-side in memory**, one slot per user and
  per resource, **overwritten** by the next bulk write and **consumed** on success — so undo is
  **single-level**, like the day restore point: a second call → **409 `nothing_to_undo`**, as does a
  user who has run no bulk write. It does not survive a server restart, which is deliberate: the
  toast that offers _Annuler_ is the only door to it, and that toast does not survive a restart
  either.

## Numbers, units, dates

- All masses in grams, body weight in kg, energy kcal; SI only.
- Dates `YYYY-MM-DD`; instants ISO-8601 UTC.
- Server returns full-precision numbers; the client rounds for display
  (`logic/00-conventions.md`).

## Reserved (not implemented in v1)

- `POST /api/v1/advisor/query` — generic AI advisor hook (OPEN_GAPS #14). Returns **501
  not_implemented**. When enabled it accepts a curated payload (recent intake, macro
  adherence, weight trend, deficit) and calls the configured OpenAI-compatible endpoint
  from `app_user.settings.ai`. The **connection itself** is configurable and verifiable
  — see `spec/api/weight-targets-stats-settings.md` (`/settings`, `/settings/ai/models`)
  and `spec/logic/ai-connection.md` (DECISIONS Gap 14 / B-117).
- **Per-task AI uses** live under `/api/v1/ai/*` — see `spec/api/ai.md`. The first
  implemented one is `POST /ai/dish-photo-macros` (B-118); `meal_suggestions` / `advice`
  task endpoints remain reserved.

## Data management (IMP-1)

User-facing account data round-trip — export / wipe / import (REPLACE/restore) under
`/api/v1/data`; see `data-export-import.md`. This is **distinct from O1** (the one-shot Excel → DB
ETL script, out of the dev plan): O1 ingests a spreadsheet, this round-trips Macronome's own
extract. Credentials are never exported/imported/wiped. Error codes: `import_invalid_format`,
`import_unsupported_version`.
