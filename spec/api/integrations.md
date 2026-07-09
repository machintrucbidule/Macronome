# API — integrations (Home Assistant, BarclaudeGateway, Google Drive)

See `00-conventions.md`. Scoped to the authenticated user. Logic in
`spec/logic/integrations-connections.md`; stored shapes in `spec/schema/tables-catalog.md`
(`settings.integrations`); the settings read/patch transport is documented in
`weight-targets-stats-settings.md` §Settings.

The Home Assistant and BarclaudeGateway endpoints are **server-side proxies** reading the
**stored** connection config — secrets never reach the browser. The UI persists edits first
(a normal `/settings` PATCH), then calls the proxy ("persist then test", same flow as
`/settings/ai/models`). The **Google Drive** endpoints (backup, B-208) are not proxies but
an OAuth handshake + backup actions; they read/write the same stored config and likewise
never return secrets. All config (URLs, tokens, Drive scheduling fields) is written through
the normal `PATCH /settings` merge — these endpoints only perform actions, never store
plain config themselves (except the OAuth callback, which writes the obtained token).

## Settings transport (read/patch)

- On **read** (`GET /settings`), `integrations` is always present and **redacted**
  (`integrations-connections.md §4`):
  ```json
  {
    "home_assistant": {
      "base_url": "http://homeassistant.local:8123",
      "token_set": true,
      "weight_entity_id": "sensor.scale_weight",
      "weight_round_decimals": 1
    },
    "barclaude_gateway": { "base_url": "http://gateway.local:8080", "api_key_set": true },
    "google_drive": {
      "client_id": "1234.apps.googleusercontent.com",
      "client_secret_set": true,
      "refresh_token_set": true,
      "folder_id": "F1",
      "enabled": true,
      "retention_days": 7,
      "time_of_day": "03:00",
      "last_backup_at": "2026-01-15T02:00:00Z",
      "last_status": "ok",
      "last_error": null
    }
  }
  ```
  Any connection is `null` when not configured.
- On **`PATCH /settings`**, `integrations` is a partial object merged per connection
  (`integrations-connections.md §3`; secrets absent = keep, `""`/`null` = clear;
  a connection set to `null` disconnects it). Validation is local (Zod at the
  controller): bad URL → 422 (`invalid_url`), bad entity id → 422 (`invalid_entity_id`),
  bad decimals → 422 (`invalid_round_decimals`), bad Drive retention → 422
  (`invalid_retention_days`), bad Drive time → 422 (`invalid_time_of_day`). For
  `google_drive` the **only patchable fields** are `client_id`, `client_secret`, `enabled`,
  `retention_days`, `time_of_day`; `refresh_token` / `folder_id` / `last_*` are
  server-written and **ignored if present in a patch** (`integrations-connections.md §3`).

## Endpoints

- `GET /integrations/home-assistant/weight` — proxy of
  `GET {ha.base_url}/api/states/{ha.weight_entity_id}` (Bearer token). → 200
  `{data: {weight_kg, measured_at, unit, entity_id}}` — `weight_kg` rounded server-side
  to `ha.weight_round_decimals` (`integrations-connections.md §5`). This call is the HA
  card's **connection proof** and the weigh-in modal's **import source** (B-180).
  Errors: `ha_not_configured` 409 · `ha_unauthorized` 502 · `ha_entity_not_found` 502 ·
  `ha_no_measurement` 409 · `ha_unavailable` 503 · `ha_unreachable` 504 ·
  `ha_bad_response` 502.
- `GET /integrations/barclaude-gateway/ping` — proxy of `GET {bg.base_url}/api/v1/ping`
  (`X-API-Key`). → 200 `{data: {status: "ok", version: 1}}` — the gateway card's
  **connection proof** (`integrations-connections.md §6`).
  Errors: `gateway_not_configured` 409 · `gateway_unauthorized` 502 ·
  `gateway_unavailable` 503 · `gateway_unreachable` 504 · `gateway_bad_response` 502.
- `GET /integrations/barclaude-gateway/search?q=` — proxy of
  `GET {bg.base_url}/api/v1/search?q=&size=10` (`integrations-connections.md §8.1`;
  the server always passes `size=10`). Zod: `q` trimmed, **min 3 chars** → else 422
  (`q: too_short`), no outbound call. → 200 `{data: ChronoProductSummary[]}` with
  `ChronoProductSummary = {id, name, brand, image_url, unit_quantity_label, price_eur,
product_url}` (absent upstream fields → null; `price_eur ← price.default`;
  `product_url` built server-side from the id, `integrations-connections.md §8.1`;
  thumbnails are loaded browser-side from the public `image_url`, not proxied in v1).
  Errors: same table as `/ping`.
- `GET /integrations/barclaude-gateway/products/:id` — proxy of
  `GET {bg.base_url}/api/v1/products/{id}` (id or EAN). → 200
  `{data: ChronoProductSummary & {food_prefill}}` where `food_prefill` is the
  **server-side** product → food mapping (`integrations-connections.md §8.2`:
  macros only when `nutrition.base` is 100 g/100 ml, absent field → null, kcal never
  derived from kJ, `name = "Brand Name"`, `comment = unitQuantityLabel`).
  Errors: same table as `/ping` **plus** upstream 404/`not_found` → 404
  `gateway_not_found`.

## Google Drive backup (B-208)

OAuth handshake + backup actions on the stored `integrations.google_drive` connection
(`integrations-connections.md §9`; scheduling/rotation in `backup-scheduler.md`). No
config-write endpoint: `client_id`/`client_secret` and the scheduling fields
(`enabled`/`retention_days`/`time_of_day`) are set through the normal `PATCH /settings`
merge (above). All error codes: `integrations-connections.md §9.5`.

- `POST /integrations/google-drive/connect` — starts the OAuth flow. Requires
  `client_id`/`client_secret` stored (`integrations-connections.md §9.2`) and an **HTTPS**
  resolved origin — `PUBLIC_ORIGIN` when set, else derived from the trusted-proxy headers
  (B-217). → 200 `{data: {auth_url}}` (the Google consent URL the browser then visits).
  CSRF-protected. Errors: `gdrive_not_configured` 409 · `gdrive_insecure_context` 409.
- `GET /integrations/google-drive/callback?code&state` — Google's redirect target (the
  exact URL the operator registered). Validates `state`, exchanges `code` → `refresh_token`
  (stored, server-written only), creates/finds the "Macronome Backups" folder (stores
  `folder_id`), then **302-redirects** the browser to `/parametres`. Not a JSON endpoint
  (it is hit by the browser via Google). On `?error=access_denied` it redirects to
  `/parametres` with an error marker; internal failures map to the codes below.
  Errors: `gdrive_oauth_denied` 400 · `gdrive_oauth_failed` 502 · `gdrive_unreachable` 504.
- `GET /integrations/google-drive/status` — the current backup state for the Settings card
  (also derivable from the redacted `GET /settings`, provided as a focused endpoint for
  status polling). → 200 `{data: {connected, enabled, retention_days, time_of_day,
last_backup_at, last_status, last_error, folder_url}}` where `connected` = a
  `refresh_token` is stored and `folder_url` = the Drive folder link (or `null`). Returns
  the not-configured state (`connected:false`) rather than an error when nothing is set up.
- `POST /integrations/google-drive/disconnect` — best-effort revokes the token at Google,
  clears `refresh_token`/`folder_id`/`last_*`, sets `enabled:false`, keeps
  `client_id`/`client_secret`/config (`integrations-connections.md §9.3`). → 200 `{data:
{connected: false}}`. CSRF-protected. Idempotent (already-disconnected → 200).
- `POST /integrations/google-drive/backup-now` — runs one backup immediately
  (`buildExport` → upload → rotate, `integrations-connections.md §9.4`), then persists the
  `last_*` status. → 200 `{data: {last_backup_at, last_status, last_error}}`. Requires a
  connected account. CSRF-protected.
  Errors: `gdrive_not_connected` 409 · `gdrive_token_expired` 502 · `gdrive_unauthorized`
  502 · `gdrive_quota_exceeded` 502 · `gdrive_unavailable` 503 · `gdrive_unreachable` 504 ·
  `gdrive_bad_response` 502.
