# API contract — conventions

REST, API-first; consumed by the web SPA today and the React Native app later.
Defines endpoints only (no server implementation). All payloads JSON.
Base path `/api/v1`. See `logic/*` for computation rules.

## Auth & session (§7)

- `POST /api/v1/auth/login` — body `{username, password, stay_signed_in}`.
  Sets an HTTP-only, Secure, SameSite cookie session; long-lived refresh when
  `stay_signed_in`. 200 `{user:{id,username,locale,theme}}`.
  - Failed credentials → **401** with a generic, non-enumerating body
    `{error:{code:'invalid_credentials'}}` (never reveal whether the user
    exists).
  - Rate-limit/lockout → **429** `{error:{code:'locked_out', retry_after_s}}`.
- `POST /api/v1/auth/logout` — 204; clears session.
- `GET /api/v1/auth/session` — 200 current user or 401.
- Password change is a dedicated secure flow (not a plain field):
  `POST /api/v1/auth/password` (current + new); never logged.
- First-run bootstrap (single owner account):
  - `GET /api/v1/auth/setup-state` — unauthenticated, non-enumerating; 200
    `{setup_required}` (whether _any_ user exists yet; never reveals _which_).
  - `POST /api/v1/auth/setup` — body `{username, password, sex, birthdate, height_cm}`.
    Allowed **only while no user exists**; creates the single owner, seeds defaults,
    opens the session. Once an owner exists → **409** `{error:{code:'setup_already_completed'}}`
    (creates nothing).
- **No open/public sign-up.** Account creation is limited to the one-shot,
  zero-user-gated first-run setup above (disabled the instant the owner exists); no open
  registration endpoint is ever exposed. CSRF protection on all state-changing requests.

## Tenancy

Every endpoint operates on the authenticated user; the server scopes all
user-owned reads/writes by `user_id`. Cross-tenant access → 404 (not 403, to
avoid existence leaks).

## Error shape (consistent)

```json
{
  "error": { "code": "string_snake", "message": "human readable", "details": { "field": "reason" } }
}
```

Validation failures → **422** with per-field `details`.
Domain blocks (e.g. leftover incoherent) → **409** with a `code` the client maps
to a warning (e.g. `leftover_exceeds_served`, `gross_below_tare`). Targets carb
ceiling ≤ 0 is **not** an error — it returns 200 with a `warnings` array.

## Status codes

200 OK · 201 Created · 204 No Content · 400 malformed · 401 unauth ·
403 forbidden (rare) · 404 not found / cross-tenant · 409 domain conflict ·
422 validation · 429 rate-limited · 500 server.

## List behaviour

- Pagination: `?limit=` (default 50, max 200) `&cursor=` (opaque, keyset on
  `(sort_key,id)`); responses include `{data:[...], next_cursor}`.
- Sorting: `?sort=field&dir=asc|desc` where allowed per resource.
- Filtering: documented per resource.
- **Autocomplete search** (`?q=`): diacritic-insensitive, matches
  `normalized_name` via `unaccent`+`pg_trgm`; returns ranked matches, default
  `limit=10`. Used by foods, recipes, and the combined food∪recipe log search.

## Numbers, units, dates

- All masses in grams, body weight in kg, energy kcal; SI only.
- Dates `YYYY-MM-DD`; instants ISO-8601 UTC.
- Server returns full-precision numbers; the client rounds for display
  (`logic/00-conventions.md`).

## Reserved (not implemented in v1)

- `POST /api/v1/advisor/query` — AI advisor hook (OPEN_GAPS #14). Returns **501
  not_implemented** in v1. When enabled it accepts a curated payload (recent
  intake, macro adherence, weight trend, deficit) and the configured
  OpenAI-compatible endpoint from `app_user.settings.llm_endpoint`.
- No import/export endpoints in v1 (migration is the one-shot ETL script).
