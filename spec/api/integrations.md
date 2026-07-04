# API — integrations (Home Assistant, BarclaudeGateway proxies)

See `00-conventions.md`. Scoped to the authenticated user. Logic in
`spec/logic/integrations-connections.md`; stored shapes in `spec/schema/tables-catalog.md`
(`settings.integrations`); the settings read/patch transport is documented in
`weight-targets-stats-settings.md` §Settings.

All endpoints are **server-side proxies** reading the **stored** connection config —
secrets never reach the browser. The UI persists edits first (a normal `/settings`
PATCH), then calls the proxy ("persist then test", same flow as `/settings/ai/models`).

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
    "barclaude_gateway": { "base_url": "http://gateway.local:8080", "api_key_set": true }
  }
  ```
  Either connection is `null` when not configured.
- On **`PATCH /settings`**, `integrations` is a partial object merged per connection
  (`integrations-connections.md §3`; secrets absent = keep, `""`/`null` = clear;
  a connection set to `null` disconnects it). Validation is local (Zod at the
  controller): bad URL → 422 (`invalid_url`), bad entity id → 422 (`invalid_entity_id`),
  bad decimals → 422 (`invalid_round_decimals`).

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
