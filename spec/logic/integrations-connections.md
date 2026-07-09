# Logic spec — external integrations (Home Assistant, BarclaudeGateway, Google Drive)

Optional **external integrations**, each stored as a connection config on
`app_user.settings.integrations` (see `spec/schema/tables-catalog.md`) and consumed
exclusively through **server-side code** (`spec/api/integrations.md`) — secrets never
reach the browser, and the calls work when the app is used remotely:

- **Home Assistant** — read the latest smart-scale measurement to pre-fill the weigh-in
  modal's weight field (B-180). Nothing is built on the HA side: the read uses HA's
  standard REST API with a user-created long-lived access token. _Local-network._
- **BarclaudeGateway** — a self-hosted drive-product gateway (local HTTP API, `X-API-Key`
  auth) backing the Chronodrive product search in the food modal (B-182; the search and
  product mapping are specified in §8, added by that batch). _Local-network._
- **Google Drive** — an **outbound cloud** integration for the nightly off-host backup of
  the data-export envelope (B-208). Unlike the two above it uses **OAuth** (authorization
  code + refresh token) rather than a static secret, and it is **opt-in / dormant by
  default** and requires a hardened deployment (HTTPS + trusted proxy). Specified in §9.

The first two follow the same doctrine as `ai-connection.md`: local validation, deep
partial merge with secret keep/clear semantics, redaction to `*_set` booleans, and a "the
useful call is the connection proof" test. Google Drive (§9) reuses the merge/redaction
doctrine but adds the first **OAuth handshake** in the codebase.

## 1. The connection objects

`settings.integrations` always has all three keys; each is `null` until configured:

```
integrations : {
  home_assistant    : HA | null,
  barclaude_gateway : BG | null,
  google_drive      : GD | null,
}

HA = {
  base_url              : string   // absolute URL of the HA instance (http allowed on LAN)
  token                 : string   // SECRET — long-lived access token
  weight_entity_id      : string   // the scale's weight sensor entity id — ALWAYS user-supplied
  weight_round_decimals : int      // 0..3, decimals for the imported weight; default 1
}

BG = {
  base_url : string                // absolute URL (host+port) of the gateway
  api_key  : string                // SECRET — printed once in the gateway's logs at first boot
}

GD = {                             // Google Drive backup (§9); OAuth, opt-in, dormant by default
  client_id      : string          // operator's OAuth 2.0 client id (public, not a secret)
  client_secret  : string          // SECRET — operator's OAuth client secret
  refresh_token  : string          // SECRET — obtained via the Connect flow; server-written ONLY (never via PATCH)
  folder_id      : string | null   // id of the app-created "Macronome Backups" Drive folder (null until first backup)
  enabled        : bool            // scheduler opt-in; default false (dormant)
  retention_days : int             // 1..90 rolling days kept on Drive; default 7
  time_of_day    : "HH:MM"         // local scheduled time (server TZ); default "03:00"
  last_backup_at : string | null   // ISO-8601 UTC of the last successful backup; server-written
  last_status    : "ok" | "error" | null   // outcome of the last attempt; server-written
  last_error     : string | null   // short reason when last_status = "error"; server-written
}
```

`google_drive` is the first OAuth connection: the operator supplies `client_id` /
`client_secret` (their own Google OAuth client — Macronome ships none), and the one-click
**Connect** flow (§9) obtains and stores the `refresh_token`. The scope is least-privilege
**`drive.file`**, so the app only ever sees the files/folder it creates. The scheduling
fields (`enabled`, `retention_days`, `time_of_day`) and the server-written status fields
(`last_*`, `folder_id`) live on the same object; only the two secrets are redacted (§4).

`weight_entity_id` is **never defaulted, seeded, or hardcoded** in code — it is typed by
the user (findable in HA under _Developer tools → States_). Examples in this spec use the
neutral `sensor.scale_weight`.

## 2. Validation

Local (shape/format), never calls the remote host:

- `base_url` (both) — an **absolute** `http`/`https` URL; malformed → `invalid_url`.
  Plain `http://` is accepted (LAN deployments; same SSRF stance as `ai.base_url` — a
  single-owner self-hosted app, recorded in `DECISIONS.md`).
- `token` / `api_key`, when present, are **non-empty after trim** (absence is handled by
  merge, §3).
- `weight_entity_id` matches `^[a-z0-9_]+\.[a-z0-9_]+$` (HA `domain.object_id` format) →
  else `invalid_entity_id`.
- `weight_round_decimals` is an **integer 0..3** → else `invalid_round_decimals`; when
  absent from a creating patch it defaults to `1`.

Google Drive (`google_drive`, patchable fields only — `refresh_token`/`folder_id`/`last_*`
are server-written, never accepted from a patch):

- `client_id` / `client_secret`, when present, are **non-empty after trim** (absence is
  handled by merge, §3); no remote call is made here (validated at Connect time, §9).
- `retention_days` is an **integer 1..90** → else `invalid_retention_days`; defaults to `7`
  when absent from a creating patch.
- `time_of_day` matches `^([01]\d|2[0-3]):[0-5]\d$` (24-h `HH:MM`) → else
  `invalid_time_of_day`; defaults to `"03:00"` when absent from a creating patch.
- `enabled` is a boolean; defaults to `false` when absent from a creating patch.

## 3. Merge semantics (partial update)

A `PATCH /settings` carries a partial `integrations`; merged **per connection**:

- A connection key **absent** from the patch → that stored connection is untouched.
- A connection key set to **`null`** → that connection is **disconnected** (stored as
  `null`) without touching the other one (or `ai`).
- A connection patch object is merged field-by-field onto the stored connection:
  - non-secret fields (`base_url`, `weight_entity_id`, `weight_round_decimals`) —
    present → replace; absent → keep;
  - **secrets** (`token` / `api_key`) — **absent** ⇒ keep the stored secret; **`""` or
    `null`** ⇒ clear it; any other value ⇒ replace. (Same rule as `ai.api_key` — the
    masked UI updates everything else without resending the secret.)
- Patching a connection that was `null` creates it from the patch (which must then carry
  the required fields; `weight_round_decimals` defaults to 1 when absent).
- **Google Drive** merges by the same rules with two specifics: (a) the secret rule above
  applies to `client_secret` (absent ⇒ keep, `""`/`null` ⇒ clear, else replace); (b) the
  **server-written** fields `refresh_token`, `folder_id`, `last_backup_at`, `last_status`,
  `last_error` are **never read from a patch** — they are set only by the OAuth callback,
  the scheduler, and Backup-now (§9). Clearing `client_secret` (or setting the connection
  to `null`) does not by itself revoke the stored `refresh_token`; disconnect does (§9).

## 4. Redaction (read side)

Pure function `redactIntegrations(integrations) → read` — applied before the config
leaves the API:

- `home_assistant.token` is removed, replaced by `token_set: boolean` (true iff a
  non-empty token is stored).
- `barclaude_gateway.api_key` is removed, replaced by `api_key_set: boolean`.
- `google_drive.client_secret` is removed, replaced by `client_secret_set: boolean`;
  `google_drive.refresh_token` is removed, replaced by `refresh_token_set: boolean` (the
  read side's "connected" signal). `client_id`, `folder_id`, `enabled`, `retention_days`,
  `time_of_day`, and the `last_*` status fields pass through unchanged.
- All other fields pass through unchanged. `null` connection in → `null` out.
- Raw secrets are **never** serialised to a client and **never** logged. This includes the
  Google `refresh_token`: it is exposed to the client only as the `refresh_token_set`
  boolean, exactly like the static secrets.

## 5. Home Assistant weight read (B-180)

Server-side proxy, reading the **stored** HA config:

- Request: `GET {base_url}/api/states/{weight_entity_id}` with header
  `Authorization: Bearer {token}`.
- Success (HTTP 200) body: `{ state, last_changed, attributes: { unit_of_measurement } }`.
- The proxy returns `{ weight_kg, measured_at, unit, entity_id }` where:
  - `weight_kg` = `Number(state)` **rounded half up to `weight_round_decimals` decimals**
    (server-side — the web never computes);
  - `measured_at` = `last_changed` (ISO datetime, passed through);
  - `unit` = `attributes.unit_of_measurement` (must be `kg`, see below);
  - `entity_id` echoes the configured entity.
- `state` of `"unavailable"` or `"unknown"` → `ha_no_measurement` (the entity exists but
  has no usable value right now).
- Non-numeric `state`, or `unit_of_measurement` ≠ `kg` → `ha_bad_response` (SI-only,
  `spec/logic/00-conventions.md`; no unit conversion in v1).

This read is also the HA card's **connection proof** (the "Tester" button): the UI
persists the edited config first (normal `/settings` PATCH), then calls the proxy — same
"persist then test" flow as `/settings/ai/models`.

### Worked examples (oracles)

1. **Rounding, default.** `state:"83.3521"`, unit `kg`, `weight_round_decimals:1` →
   `{ weight_kg: 83.4, measured_at: <last_changed>, unit: "kg", entity_id: "sensor.scale_weight" }`.
2. **Rounding, 2 decimals.** Same state, `weight_round_decimals:2` → `weight_kg: 83.35`.
3. **Rounding, half up.** `state:"80.05"`, decimals 1 → `weight_kg: 80.1`.
4. **No measurement.** `state:"unavailable"` (or `"unknown"`) → error `ha_no_measurement`.
5. **Bad unit.** `state:"183.5"`, unit `lb` → error `ha_bad_response`.
6. **Non-numeric.** `state:"on"`, unit `kg` → error `ha_bad_response`.

## 6. Gateway connection proof

- Request: `GET {base_url}/api/v1/ping` with header `X-API-Key: {api_key}`.
- Success: HTTP 200 `{ status: "ok", version: <int> }` → passed through.
- This ping is the gateway card's **connection proof** (same doctrine as §5 / "list
  models is the proof" — no separate test endpoint). Same persist-then-test flow.

## 7. Error codes & outbound policy

Upstream mapping (consumed by the API layer; codes mirrored in `shared/errors.ts`):

| Condition (Home Assistant proxy)                         | Error code            | HTTP |
| -------------------------------------------------------- | --------------------- | ---- |
| `integrations.home_assistant` is `null` / missing pieces | `ha_not_configured`   | 409  |
| upstream 401/403 (bad or revoked token)                  | `ha_unauthorized`     | 502  |
| upstream 404 (unknown entity id)                         | `ha_entity_not_found` | 502  |
| `state` `"unavailable"` / `"unknown"`                    | `ha_no_measurement`   | 409  |
| upstream 500/502/503/504 (after retry)                   | `ha_unavailable`      | 503  |
| network failure / timeout / DNS / refused (after retry)  | `ha_unreachable`      | 504  |
| 2xx unparseable, non-numeric state, wrong unit, other    | `ha_bad_response`     | 502  |

| Condition (BarclaudeGateway proxy)                      | Error code               | HTTP |
| ------------------------------------------------------- | ------------------------ | ---- |
| `integrations.barclaude_gateway` is `null`              | `gateway_not_configured` | 409  |
| upstream 401 (`unauthorized` envelope)                  | `gateway_unauthorized`   | 502  |
| upstream 500/502/503/504 (after retry)                  | `gateway_unavailable`    | 503  |
| network failure / timeout / DNS / refused (after retry) | `gateway_unreachable`    | 504  |
| 2xx unparseable / other upstream non-2xx                | `gateway_bad_response`   | 502  |

Outbound policy (both hosts): transient failures (network + 5xx) are retried briefly
(3 attempts total, short delay); **401/403/404 are never retried**. Request timeouts are
short — **≤ 10 s** for HA, **≤ 8 s** for the gateway — so a modal button never hangs.
Secrets are sent only in the auth header of the outbound request and are never logged.

For the product proxies (§8) one row extends the gateway table:

| Condition (BarclaudeGateway product proxy)     | Error code          | HTTP |
| ---------------------------------------------- | ------------------- | ---- |
| upstream 404 (`not_found` envelope) on product | `gateway_not_found` | 404  |

## 8. Chronodrive product search & food mapping (B-182)

Two server-side proxies back the food modal's _Recherche chronodrive_ dialog. Both read
the stored gateway config and authenticate with `X-API-Key` (§6 doctrine).

### 8.1 Search

- UI contract: the query is **debounced** and only submitted at **≥ 3 characters**
  (trimmed); the dialog shows at most **10 compact results**.
- Request: `GET {base_url}/api/v1/search?q={q}&size=10` (the server always passes
  `size=10` — the cap is server-side, not client-side).
- Success: the upstream `{ products: ProductSummary[] }` is mapped to the compact
  summary `{ id, name, brand, image_url, unit_quantity_label, price_eur, product_url }`:
  - `brand`, `unitQuantityLabel` absent → `null`;
  - `image_url ← image` (absolute public URL; the browser loads thumbnails directly —
    images are not proxied in v1);
  - `price_eur ← price.default` (euros, display-only), absent → `null`;
  - `product_url` = `https://www.chronodrive.com/p-P{id}` (`null` when `id` is absent) —
    the site 301-redirects this id-only form to the canonical product page (verified);
    built server-side so the Chronodrive URL scheme stays in the domain mapping.
- A `q` shorter than 3 characters after trim is rejected at the controller (422,
  `q: too_short` via Zod) — no outbound call.

### 8.2 Product → food pre-fill mapping (server-side)

`mapProduct(raw) → food_prefill` — pure function, applied by the API (rule 2: the web
never computes a nutrition figure):

- **Base gate (tolerant)**. `nutrition.base` on the live gateway is **free text or
  absent** (observed on a 24-product sample: `100 g`, `100 G`, `100 mL`, `100 grammes`,
  `100.000 GR`, `Pour 100g`, `par portion de 100g`,
  `Valeurs nutritionnelles moyennes pour 100 ml`, and missing entirely), so the gate is
  a rule, not an equality:
  - **Base absent/empty → mapped.** The EU INCO regulation makes the per-100 g/100 ml
    declaration mandatory — it is what Chronodrive publishes — so an unlabelled table
    is per-100 by law.
  - **Base present → mapped iff the text references 100 g/ml**: normalised (lowercased,
    spaces removed), it must match `100` (optionally `.0+`/`,0+`) followed by
    `g`/`gr`/`gramme(s)`/`ml`, not preceded by a digit and not followed by a letter —
    this accepts every observed per-100 spelling, including `par portion de 100g`
    (a portion that _is_ 100 g), and rejects `1000 g`-style false positives.
  - **Anything else → all four macros `null`** (e.g. `portion (30 g)`, `55 g` — the
    only case where mapping would silently store wrong per-100 macros).
- Field mapping (a field **absent** from the gateway payload — manufacturer did not
  declare it — maps to `null`; the others are kept):
  - `kcal_per_100g ← nutrition.energyKcal` — **never derived from `energyKj`**;
  - `fat_per_100g ← nutrition.fat`;
  - `carb_per_100g ← nutrition.carbohydrate`;
  - `protein_per_100g ← nutrition.protein`.
- `name = [brand, name].filter(Boolean).join(' ')` (space-separated, "Marque Nom").
- `comment = unitQuantityLabel ?? null` (the product weight label, e.g. `"500 g"`).
- **No named portion** is derived from the product weight (owner decision).
- UI contract: a `null` macro leaves the field **empty** and the modal shows a
  non-blocking "à compléter" notice — the notice wording must state that an empty
  macro field is **saved as 0** (existing `draftToBody` behaviour).

### 8.3 Worked examples (oracles)

1. **Full mapping.** `{brand:"Panzani", name:"Spaghetti", unitQuantityLabel:"500 g",
nutrition:{base:"100 g", energyKcal:361, fat:1.4, carbohydrate:72, protein:12}}` →
   `{name:"Panzani Spaghetti", kcal_per_100g:361, fat_per_100g:1.4, carb_per_100g:72,
protein_per_100g:12, comment:"500 g"}`.
2. **Non-100 g base.** Same product with `nutrition.base:"portion (30 g)"` → all four
   macros `null` (name/comment still mapped).
3. **Absent field.** Same product without `nutrition.fat` → `fat_per_100g:null`, the
   other three kept.
4. **No brand.** `{brand:null, name:"Spaghetti", …}` → `name:"Spaghetti"` (no leading
   space); `unitQuantityLabel` absent → `comment:null`.
5. **kJ only.** `nutrition:{base:"100 g", energyKj:1530}` (no `energyKcal`) →
   `kcal_per_100g:null` (never derived from kJ).
6. **Spacing-tolerant base.** `nutrition:{base:"100ml", energyKcal:47, fat:1.6,
carbohydrate:4.8, protein:3.3}` (no space — the live gateway form) → all four macros
   mapped (`kcal_per_100g:47`, …); same for `"100 G"`.
7. **Product URL.** summary `{id:"387343", …}` →
   `product_url:"https://www.chronodrive.com/p-P387343"`; missing id → `null`.
8. **Absent base.** `nutrition:{energyKcal:389, fat:18, carbohydrate:33, protein:32}`
   (no `base` key — observed live on a protein bar and on chicken fillets) → all four
   macros mapped (INCO default).
9. **Free-text per-100 bases** (all observed live) → mapped: `"Pour 100 g"`,
   `"par portion de 100g"`, `"Valeurs nutritionnelles moyennes pour 100 ml"`,
   `"100 grammes"`, `"100.000 GR"`.
10. **Non-100 bases** → all four macros `null`: `"portion (30 g)"`, `"55 g"`,
    `"1000 g"` (digit guard: `1000` must not read as `100`).

## 9. Google Drive backup (B-208)

The **outbound** integration: a nightly, off-host backup of the data-export envelope
(`spec/api/data-export-import.md` — the exact `GET /data/export` body) to the operator's
own Google Drive. It is **opt-in** and **dormant by default** (`enabled:false`), and its
**scheduling / rotation logic lives in `spec/logic/backup-scheduler.md`**; this section
owns the **connection**, the **OAuth handshake**, and the **Drive operations**.

### 9.1 Why OAuth, and the deployment posture

- **OAuth, not a service account.** On a personal Gmail, service-account-owned files count
  against the service account's own (0 GB) quota, so a service account cannot store a
  personal backup. The user therefore authorises the app against **their own** Drive via
  OAuth. Each **operator** brings **their own** Google OAuth client (`client_id` /
  `client_secret`) — Macronome ships none. (Rationale in `DECISIONS.md` → "B-208".)
- **Least-privilege scope `drive.file`.** The app requests only `drive.file`, which grants
  access **solely to files the app creates**. So the app **creates and manages its own
  "Macronome Backups" folder** (no arbitrary existing-folder picker — that would need the
  restricted full-Drive scope and Google's heavy verification).
- **Hardened posture required (opt-in).** The Connect flow (§9.2) needs a **valid HTTPS
  origin behind a trusted proxy**, because the OAuth `redirect_uri` must be an exact,
  Google-registered HTTPS URL. ADR-0001's default is plain HTTP, so **Connect only
  completes once the operator has hardened** the deployment (see `docs/architecture/ops.md`
  §6 and ADR-0004). While dormant, the plain-HTTP default is unaffected.
- **Durable token.** Google expires refresh tokens after 7 days while the OAuth consent
  screen is in **"Testing"**; the operator must **publish the consent screen to
  "Production"** (it stays unverified — the warning is expected and accepted) so the token
  is durable. Documented in the in-app setup guide and `ops.md`.

### 9.2 OAuth handshake (Connect)

The app resolves its **public origin** and uses it for the callback URL
`{origin}/api/v1/integrations/google-drive/callback` (B-217): the explicit **`PUBLIC_ORIGIN`**
env when set (robust behind a reverse proxy / tunnel), else the request origin — `scheme` +
`Host` honouring `X-Forwarded-Proto` / `X-Forwarded-Host` **only from the trusted proxy** (same
`TRUSTED_PROXY` gate as the secure cookie, `security.md`). The **same resolved origin** is used
to build the redirect URI **and** to validate the HTTPS gate. Note the callback URL shown in the
Settings card is browser-derived (`window.location.origin`), so it may read https even when the
**server** cannot yet (unset `PUBLIC_ORIGIN` + untrusted proxy) — see `ops.md §6c`.

1. **Start** (`POST …/connect`): requires `client_id` + `client_secret` stored, else
   `gdrive_not_configured`; requires the **resolved origin to be HTTPS**, else
   `gdrive_insecure_context` (enforces the hardened posture). The app builds the Google
   authorization URL with `scope=https://www.googleapis.com/auth/drive.file`,
   `access_type=offline`, `prompt=consent` (to always receive a refresh token),
   `redirect_uri` = the derived callback, and a random **`state`** persisted server-side
   for the single owner and checked on return (CSRF/anti-forgery). Returns `{ auth_url }`.
2. **Return** (`GET …/callback?code&state`): validates `state`; on the user denying
   consent Google returns `?error=access_denied` → `gdrive_oauth_denied`. Otherwise the app
   **exchanges** `code` at Google's token endpoint (with `client_id`/`client_secret`/the
   same `redirect_uri`) for a `refresh_token` (+ short-lived `access_token`); exchange
   failure → `gdrive_oauth_failed`. The `refresh_token` is **stored** (`google_drive
.refresh_token`, server-written only), and the app **creates or finds** the "Macronome
   Backups" folder (§9.4), persisting its `folder_id`. The callback then redirects the
   browser back to `/parametres`.

The short-lived `access_token` is **not persisted** — it is obtained on demand from the
`refresh_token` at backup time (a `refresh_token` grant), cached in memory only.

### 9.3 Disconnect

`POST …/disconnect` **best-effort revokes** the token at Google
(`POST https://oauth2.googleapis.com/revoke`), then clears `refresh_token`, `folder_id`,
and the `last_*` status, and sets `enabled:false`. It **keeps** `client_id` /
`client_secret` / `retention_days` / `time_of_day` so the operator can reconnect in one
click. A revoke that fails upstream still clears the local token (the connection is gone
either way); it is never surfaced as an error.

### 9.4 Drive operations (folder, upload, list, rotate)

All calls are server-side, authenticated with a fresh `access_token` (Bearer), reading the
**stored** connection. All go through the shared outbound-retry policy (§7).

- **Folder create/find.** Search the app's own space for a `folder_id`; if none stored,
  query `mimeType='application/vnd.google-apps.folder' and name='Macronome Backups' and
trashed=false`; create it if absent (`files.create`, folder mime). Persist `folder_id`.
- **Upload.** A **multipart** `files.create` (`uploadType=multipart`) with metadata
  `{ name, parents:[folder_id] }` and the export JSON as the media body
  (`application/json`). The body is exactly `buildExport(userId)` — no separate format.
- **Filename** = `macronome-backup-{YYYY-MM-DD}T{HHMMSS}Z.json` (UTC instant of the run;
  timestamped so a same-day manual "Backup now" never overwrites the nightly one).
- **List + rotate.** List the folder's files, then delete the ones the rotation rule
  selects (`spec/logic/backup-scheduler.md §3` — by age, keep the last `retention_days`
  rolling days). Rotation runs **after** a successful upload, never before (a failed
  upload never prunes history).

### 9.5 Error codes (Google Drive)

Consumed by the API layer; mirrored in `shared/errors.ts`.

| Condition (Google Drive)                                   | Error code                | HTTP |
| ---------------------------------------------------------- | ------------------------- | ---- |
| `client_id` / `client_secret` missing on Connect           | `gdrive_not_configured`   | 409  |
| Connect attempted over a non-HTTPS derived origin          | `gdrive_insecure_context` | 409  |
| no stored `refresh_token` (Backup-now / status needing it) | `gdrive_not_connected`    | 409  |
| user denied consent on the Google screen (`access_denied`) | `gdrive_oauth_denied`     | 400  |
| `state` mismatch, or code→token exchange failed            | `gdrive_oauth_failed`     | 502  |
| refresh grant rejected (revoked/expired token → reconnect) | `gdrive_token_expired`    | 502  |
| upstream 401/403 on a Drive call (after refresh)           | `gdrive_unauthorized`     | 502  |
| upstream 403 `storageQuotaExceeded` / 507                  | `gdrive_quota_exceeded`   | 502  |
| upstream 500/502/503/504 (after retry)                     | `gdrive_unavailable`      | 503  |
| network failure / timeout / DNS / refused (after retry)    | `gdrive_unreachable`      | 504  |
| 2xx unparseable / other upstream non-2xx                   | `gdrive_bad_response`     | 502  |

Outbound policy (Google): same retry doctrine as §7 (3 attempts, short delay; **never
retry 400/401/403/404**). Timeouts are short for interactive calls (**≤ 10 s** for
Connect/status/folder/list/delete) and longer for the **upload** (**≤ 30 s** — the export
body can be large). Secrets (`client_secret`, `refresh_token`, `access_token`) travel only
in the token-exchange body or the outbound `Authorization` header and are **never logged**.

### 9.6 Worked examples (oracles)

Redaction and merge are the pure, testable parts here (the OAuth exchange and Drive I/O are
integration-level, mocked — `spec/api/integrations.md`); scheduling/rotation oracles live
in `backup-scheduler.md`.

1. **Redaction hides both secrets.** stored `{ client_id:"cid", client_secret:"csecret",
refresh_token:"rtok", folder_id:"F1", enabled:true, retention_days:7,
time_of_day:"03:00", last_backup_at:"2026-01-15T02:00:00Z", last_status:"ok",
last_error:null }` → read `{ client_id:"cid", client_secret_set:true,
refresh_token_set:true, folder_id:"F1", enabled:true, retention_days:7,
time_of_day:"03:00", last_backup_at:"2026-01-15T02:00:00Z", last_status:"ok",
last_error:null }`.
2. **Not connected.** stored with `refresh_token:""` → `refresh_token_set:false` (the
   client's "not connected" signal); `client_secret:""` → `client_secret_set:false`.
3. **`null` connection.** `google_drive: null` in → `null` out (never configured).
4. **Merge keeps the secret.** stored `client_secret:"csecret"`, patch omits
   `client_secret` (e.g. changes only `retention_days:14`) → stored secret kept,
   `retention_days` becomes 14.
5. **Merge clears the secret.** patch `client_secret:""` (or `null`) → `client_secret`
   cleared; the app is then no longer configured for Connect.
6. **Merge replaces the secret.** patch `client_secret:"new"` → replaced.
7. **Patch cannot write server fields.** patch carrying `refresh_token:"x"` /
   `folder_id:"y"` / `last_status:"ok"` → those keys are **ignored** (stored values
   unchanged); only patchable fields (`client_id`, `client_secret`, `enabled`,
   `retention_days`, `time_of_day`) take effect.
8. **Create from null.** patch on a `null` connection with `{ client_id:"cid",
client_secret:"csecret" }` → created with `enabled:false`, `retention_days:7`,
   `time_of_day:"03:00"`, and all server fields null/absent (a not-yet-connected config).
9. **Validation.** `retention_days:0` or `100` → `invalid_retention_days`;
   `time_of_day:"3:00"` or `"24:00"` → `invalid_time_of_day`.
